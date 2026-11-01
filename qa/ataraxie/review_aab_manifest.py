#!/usr/bin/env python3
"""Inspect AAB manifest fields using the AOSP aapt2 protobuf XML schema.
No credential value is printed or saved separately.
"""
import argparse, hashlib, json, pathlib, re, subprocess, zipfile

ANDROID = "http://schemas.android.com/apk/res/android"

def varint(data, pos):
    value = shift = 0
    while True:
        if pos >= len(data) or shift > 70:
            raise ValueError("Invalid protobuf varint")
        byte = data[pos]
        pos += 1
        value |= (byte & 127) << shift
        if byte < 128:
            return value, pos
        shift += 7

def fields(data):
    pos = 0
    result = {}
    while pos < len(data):
        tag, pos = varint(data, pos)
        number, wire = tag >> 3, tag & 7
        if not number:
            raise ValueError("Invalid protobuf field")
        if wire == 0:
            value, pos = varint(data, pos)
        elif wire == 2:
            length, pos = varint(data, pos)
            value = data[pos:pos + length]
            pos += length
            if pos > len(data):
                raise ValueError("Truncated protobuf field")
        elif wire in (1, 5):
            length = 8 if wire == 1 else 4
            value = data[pos:pos + length]
            pos += length
        else:
            raise ValueError("Unsupported protobuf wire type")
        result.setdefault(number, []).append(value)
    return result

def text(message, number):
    values = message.get(number, [])
    return values[0].decode("utf-8") if values else ""

def element(node):
    values = fields(node).get(1, [])
    return fields(values[0]) if values else None

def attributes(item):
    result = {}
    for raw in item.get(4, []):
        attr = fields(raw)
        result[(text(attr, 1), text(attr, 2))] = text(attr, 3)
    return result

def walk(item):
    yield item
    for child in item.get(5, []):
        current = element(child)
        if current is not None:
            yield from walk(current)

def inspect_aab(source):
    source = pathlib.Path(source)
    with zipfile.ZipFile(source) as archive:
        root = element(archive.read("base/manifest/AndroidManifest.xml"))
        assert root and text(root, 3) == "manifest"
        top = attributes(root)
        versions = {
            "package": top.get(("", "package")),
            "version": top.get((ANDROID, "versionName")),
            "versionCode": top.get((ANDROID, "versionCode")),
        }
        assert all(versions.values()), "Raw native version fields were not found"
        map_entries = []
        permissions = []
        for item in walk(root):
            tag = text(item, 3)
            attrs = attributes(item)
            name = attrs.get((ANDROID, "name"), "")
            if tag == "uses-permission":
                permissions.append(name)
            if tag == "meta-data" and name in (
                "com.google.android.geo.API_KEY",
                "com.google.android.maps.v2.API_KEY",
            ):
                value = attrs.get((ANDROID, "value"), "")
                map_entries.append(bool(value) and
                    (value.startswith("@") or value.startswith("AIza")))
        bundles = [n for n in archive.namelist()
                   if n.endswith("/index.android.bundle")]
        assert len(bundles) == 1, "Exactly one Android JS bundle is expected"
        js = archive.read(bundles[0])
        qa_api = b"ataraxie-api.delishafrica.me" in js
        certnames = [n for n in archive.namelist() if n.startswith("META-INF/")
                     and n.endswith((".RSA", ".DSA", ".EC"))]
        assert len(certnames) == 1, "Exactly one upload certificate is expected"
        der = archive.read(certnames[0])
    pem = subprocess.run(
        ["openssl", "pkcs7", "-inform", "DER", "-print_certs"],
        input=der, capture_output=True, check=True,
    ).stdout
    pem = re.search(
        b"-----BEGIN CERTIFICATE-----.*?-----END CERTIFICATE-----", pem, re.S
    ).group()
    fingerprint = subprocess.run(
        ["openssl", "x509", "-noout", "-fingerprint", "-sha1"],
        input=pem, capture_output=True, check=True,
    ).stdout.decode().strip().partition("=")[2]
    return {
        **versions,
        "qaApiEmbedded": qa_api,
        "nativeMapsMetadataPresent": bool(map_entries),
        "nativeMapsValueConfigured": bool(map_entries) and all(map_entries),
        "backgroundLocationPermission": "android.permission.ACCESS_BACKGROUND_LOCATION" in permissions,
        "uploadCertificateSha1": fingerprint,
        "sha256": hashlib.file_digest(source.open("rb"), "sha256").hexdigest(),
        "bytes": source.stat().st_size,
    }

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("bundle")
    parser.add_argument("--app", choices=["client", "merchant", "courier"], required=True)
    parser.add_argument("--version-code", required=True)
    parser.add_argument("--output", required=True)
    args = parser.parse_args()
    review = inspect_aab(args.bundle)
    assert review["package"] == "com.delishafrica." + args.app
    assert review["version"] == "3.0.4"
    assert review["versionCode"] == args.version_code
    assert review["qaApiEmbedded"], "QA endpoint missing from native JS bundle"
    if args.app != "merchant":
        assert review["nativeMapsValueConfigured"], "Native Maps configuration missing"
    review["app"] = args.app
    review["passed"] = True
    pathlib.Path(args.output).write_text(json.dumps(review, indent=2))
    print(json.dumps(review, indent=2))
