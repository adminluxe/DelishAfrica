#!/usr/bin/env python3
"""Inspect an EAS iOS archive without exposing embedded credentials.
Does not replace Apple processing or a physical iPhone test.
"""
import argparse,datetime,hashlib,json,plistlib,subprocess,tempfile,zipfile
from pathlib import Path
p=argparse.ArgumentParser()
p.add_argument('app',choices=['client','merchant','courier'])
p.add_argument('ipa',type=Path)
p.add_argument('--build-number',required=True)
args=p.parse_args()
with zipfile.ZipFile(args.ipa) as z:
    assert z.testzip() is None,'IPA ZIP integrity failure'
    infos=[n for n in z.namelist() if n.startswith('Payload/') and n.endswith('.app/Info.plist') and n.count('/')==2]
    assert len(infos)==1,'Expected exactly one main application'
    info_name=infos[0];prefix=info_name[:-len('Info.plist')]
    info=plistlib.loads(z.read(info_name))
    profile_name=prefix+'embedded.mobileprovision'
    with tempfile.TemporaryDirectory(prefix='da-ipa-review-') as tmp:
        src=Path(tmp)/'profile.cms';dst=Path(tmp)/'profile.plist'
        src.write_bytes(z.read(profile_name));src.chmod(0o600)
        cms=subprocess.run(['openssl','cms','-verify','-inform','DER','-in',str(src),'-noverify','-out',str(dst)],capture_output=True)
        assert cms.returncode==0,'Provisioning CMS signature could not be checked'
        profile=plistlib.loads(dst.read_bytes())
    ent=profile.get('Entitlements',{})
    expiry=profile.get('ExpirationDate')
    if expiry and expiry.tzinfo is None:expiry=expiry.replace(tzinfo=datetime.timezone.utc)
    expo=plistlib.loads(z.read(prefix+'Expo.plist')) if prefix+'Expo.plist' in z.namelist() else {}
    headers=expo.get('EXUpdatesRequestHeaders',{})
    if isinstance(headers,str):headers=json.loads(headers)
    runtime=expo.get('EXUpdatesRuntimeVersion')
    executable=z.read(prefix+info['CFBundleExecutable'])
    bundles=[n for n in z.namelist() if n.startswith(prefix) and (n.endswith('.jsbundle') or n.endswith('.hbc'))]
    qa_embedded=any(b'ataraxie-api.delishafrica.me' in z.read(n) for n in bundles)
    map_module=b'AIRMap' in executable
    code_resources=prefix+'_CodeSignature/CodeResources' in z.namelist()
    bg_modes=info.get('UIBackgroundModes',[])
    location_purpose=bool(str(info.get('NSLocationWhenInUseUsageDescription','')).strip())
    checks={
      'bundle':info.get('CFBundleIdentifier')=='com.delishafrica.'+args.app,
      'version':info.get('CFBundleShortVersionString')=='3.0.4',
      'build':str(info.get('CFBundleVersion'))==args.build_number,
      'qaApiEmbedded':qa_embedded,
      'qaUpdateChannel':headers.get('expo-channel-name')=='ataraxie-ios-qa',
      'runtimeVersion':runtime=='3.0.4',
      'team':profile.get('TeamIdentifier')==['R238JQAKMG'],
      'provisionedBundle':ent.get('application-identifier')=='R238JQAKMG.com.delishafrica.'+args.app,
      'releaseEntitlement':ent.get('get-task-allow') is False,
      'appStoreProvisioning':'ProvisionedDevices' not in profile and not profile.get('ProvisionsAllDevices',False),
      'profileNotExpired':bool(expiry and expiry>datetime.datetime.now(datetime.timezone.utc)),
      'codeResourcesPresent':code_resources,
      'noBackgroundLocation':'location' not in bg_modes,
    }
    if args.app in ('client','courier'):
      checks['nativeMapModulePresent']=map_module
      checks['locationUsagePurpose']=location_purpose
    proof={
      'app':args.app,'platform':'ios','bundleIdentifier':info.get('CFBundleIdentifier'),
      'version':info.get('CFBundleShortVersionString'),'buildNumber':str(info.get('CFBundleVersion')),
      'sha256':hashlib.sha256(args.ipa.read_bytes()).hexdigest(),'bytes':args.ipa.stat().st_size,
      'provisioningCmsSignatureVerified':True,'appleCertificateChainValidated':False,
      'provisioningExpiry':expiry.isoformat() if expiry else None,
      'nativeMapModulePresent':map_module,'backgroundModes':bg_modes,
      'updateChannel':headers.get('expo-channel-name'),'runtimeVersion':runtime,
      'checks':checks,'passed':all(checks.values()),
      'appleProcessingVerified':False,'physicalIphoneVerified':False,
      'scope':'ZIP, Info.plist, embedded API/OTA config, provisioning CMS signature without chain validation, native map symbol and CodeResources presence; not a macOS codesign verification or device test.'
    }
    print(json.dumps(proof,ensure_ascii=False,indent=2))
    if not proof['passed']:raise SystemExit(1)
