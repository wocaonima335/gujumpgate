#!/usr/bin/env python3
"""
正确注入GuJumpgate扩展到Chrome的user-data-dir
使用与Chrome内部一致的格式，避免Chrome启动时清除扩展
"""
import json
import os
import shutil
import hashlib
import base64

USER_DATA_DIR = "/tmp/chrome-gujump"
EXT_SRC = "/root/GuJumpgate"
EXT_ID = "fignfifoniblkonapihmkfakmlgkbkcf"
EXT_VERSION = "0.1.2"

def main():
    default_dir = os.path.join(USER_DATA_DIR, "Default")
    ext_base_dir = os.path.join(default_dir, "Extensions", EXT_ID)
    ext_version_dir = os.path.join(ext_base_dir, f"{EXT_VERSION}_0")

    # 1. 复制扩展文件到Extensions目录
    if os.path.exists(ext_base_dir):
        shutil.rmtree(ext_base_dir)
    shutil.copytree(EXT_SRC, ext_version_dir, symlinks=False)
    print(f"[1] 扩展文件已复制到: {ext_version_dir}")

    # 验证
    mf_path = os.path.join(ext_version_dir, "manifest.json")
    assert os.path.exists(mf_path), f"manifest.json not found"
    with open(mf_path, 'r') as f:
        manifest = json.load(f)
    print(f"    manifest.json: OK (name={manifest.get('name')}, v={manifest.get('version')})")

    # 2. 读取Preferences
    pref_path = os.path.join(default_dir, "Preferences")
    with open(pref_path, 'r') as f:
        prefs = json.load(f)

    # 3. 构造扩展配置 - 使用UNPACKED类型(location=5)
    # 关键：path使用相对路径（相对于user-data-dir）
    rel_path = os.path.relpath(ext_version_dir, default_dir)
    
    ext_entry = {
        "active_permissions": {
            "api": manifest.get("permissions", []),
            "manifest_permissions": [],
            "explicit_host": manifest.get("host_permissions", []),
            "scriptable_host": []
        },
        "app_launcher_ordinal": "tza",
        "commands": {},
        "content_settings": [],
        "creation_flags": 1,
        "events": [],
        "first_install_time": "13370000000000000",
        "granted_permissions": {
            "api": manifest.get("permissions", []),
            "manifest_permissions": [],
            "explicit_host": manifest.get("host_permissions", []),
            "scriptable_host": []
        },
        "install_time": "13370000000000000",
        "last_update_time": "13370000000000000",
        "location": 5,  # UNPACKED
        "manifest": manifest,
        "path": rel_path,  # 使用相对路径
        "state": 1,  # ENABLED
        "was_installed_by_default": False,
        "was_installed_by_oem": False,
        "withholding_permissions": False
    }

    # 4. 注入到extensions.settings
    ext_settings = prefs.setdefault("extensions", {}).setdefault("settings", {})
    ext_settings[EXT_ID] = ext_entry

    # 5. 也添加到extensions.toolbar
    toolbar = prefs.setdefault("extensions", {}).setdefault("toolbar", [])
    if EXT_ID not in [t.get("id") for t in toolbar if isinstance(t, dict)]:
        toolbar.append({"id": EXT_ID})

    # 6. 写回Preferences
    with open(pref_path, 'w') as f:
        json.dump(prefs, f)
    print(f"[2] Preferences已更新 (path={rel_path})")

    # 7. 更新Secure Preferences
    sec_pref_path = os.path.join(default_dir, "Secure Preferences")
    if os.path.exists(sec_pref_path):
        with open(sec_pref_path, 'r') as f:
            sec_prefs = json.load(f)
        
        sec_ext = sec_prefs.setdefault("extensions", {}).setdefault("settings", {})
        sec_ext[EXT_ID] = ext_entry
        
        with open(sec_pref_path, 'w') as f:
            json.dump(sec_prefs, f)
        print(f"[3] Secure Preferences已更新")

    # 8. 删除hash文件（让Chrome重新计算）
    for fname in ["Preferences.hash", "Secure Preferences.hash"]:
        fpath = os.path.join(default_dir, fname)
        if os.path.exists(fpath):
            os.remove(fpath)
            print(f"[4] 已删除 {fname}")

    # 9. 删除Local State中的相关hash
    local_state_path = os.path.join(USER_DATA_DIR, "Local State")
    if os.path.exists(local_state_path):
        with open(local_state_path, 'r') as f:
            local_state = json.load(f)
        
        # 清除extensions的integrity检查
        if "extensions" in local_state:
            local_state["extensions"].pop("install_signature", None)
            with open(local_state_path, 'w') as f:
                json.dump(local_state, f)
            print(f"[5] Local State已清理")

    print("\n[*] 扩展注入完成！")

if __name__ == "__main__":
    main()
