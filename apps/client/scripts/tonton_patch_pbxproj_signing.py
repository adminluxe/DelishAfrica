#!/usr/bin/env python3
import sys,re,os

path = sys.argv[1]
team = sys.argv[2]

txt = open(path,'r',encoding='utf-8',errors='ignore').read()

def set_or_insert_in_buildsettings(block:str, key:str, value:str)->str:
  # remplace "  KEY = ...;" ou insère juste après "buildSettings = {"
  pat = re.compile(rf"(^\s*{re.escape(key)}\s*=\s*).*?;\s*$", re.MULTILINE)
  if pat.search(block):
    return pat.sub(rf"\1{value};", block)
  return block.replace("buildSettings = {", f"buildSettings = {{\n\t\t\t\t{key} = {value};", 1)

def remove_key(block:str, key:str)->str:
  # enlève lignes KEY = ...; (et variantes [sdk=...])
  block = re.sub(rf"^\s*{re.escape(key)}\s*=\s*.*?;\s*$\n?", "", block, flags=re.MULTILINE)
  block = re.sub(rf"^\s*{re.escape(key)}\[sdk=.*?\]\s*=\s*.*?;\s*$\n?", "", block, flags=re.MULTILINE)
  return block

# patch chaque buildSettings = { ... };
def patch_all_buildsettings(txt:str)->str:
  out=[]
  i=0
  while True:
    j=txt.find("buildSettings = {", i)
    if j<0:
      out.append(txt[i:])
      break
    out.append(txt[i:j])
    k=txt.find("};", j)
    if k<0:
      out.append(txt[j:])
      break
    block=txt[j:k+2]

    # force auto signing + team
    block = set_or_insert_in_buildsettings(block, "DEVELOPMENT_TEAM", team)
    block = set_or_insert_in_buildsettings(block, "CODE_SIGN_STYLE", "Automatic")
    block = set_or_insert_in_buildsettings(block, "CODE_SIGNING_ALLOWED", "YES")

    # variantes iPhoneOS
    block = set_or_insert_in_buildsettings(block, "DEVELOPMENT_TEAM[sdk=iphoneos*]", team)
    block = set_or_insert_in_buildsettings(block, "CODE_SIGN_STYLE[sdk=iphoneos*]", "Automatic")

    # clean profils manuels
    for key in [
      "PROVISIONING_PROFILE", "PROVISIONING_PROFILE_SPECIFIER",
      "PROVISIONING_PROFILE[sdk=iphoneos*]", "PROVISIONING_PROFILE_SPECIFIER[sdk=iphoneos*]",
      "CODE_SIGN_IDENTITY", "CODE_SIGN_IDENTITY[sdk=iphoneos*]",
      "CODE_SIGN_IDENTITY[sdk=iphoneos*]"
    ]:
      block = remove_key(block, key)

    out.append(block)
    i=k+2
  return "".join(out)

txt2 = patch_all_buildsettings(txt)

# patch TargetAttributes provisioning style si présent
txt2 = txt2.replace("ProvisioningStyle = Manual;", "ProvisioningStyle = Automatic;")

if txt2 != txt:
  open(path,'w',encoding='utf-8').write(txt2)
print(f"[tonton-sign] patched: {path}")