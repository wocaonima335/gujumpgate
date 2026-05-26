#!/usr/bin/env python3
"""
为GuJumpgate扩展生成唯一key并计算扩展ID
Chrome MV3扩展ID由key的SHA256哈希决定
"""
import json
import os
import subprocess
import base64
import hashlib

EXT_DIR = "/root/GuJumpgate"

def generate_rsa_key():
    """生成RSA私钥并提取公钥"""
    # 生成2048位RSA私钥
    private_key = subprocess.run(
        ["openssl", "genrsa", "2048"],
        capture_output=True, text=True
    ).stdout
    
    # 提取公钥
    public_key = subprocess.run(
        ["openssl", "rsa", "-pubout", "-outform", "DER"],
        input=private_key,
        capture_output=True
    ).stdout
    
    # Base64编码公钥（去掉DER头）
    # Chrome扩展key是SubjectPublicKeyInfo的Base64编码
    key_b64 = base64.b64encode(public_key).decode('ascii')
    
    # 计算扩展ID：SHA256(公钥DER)的前128bit转十六进制
    sha256 = hashlib.sha256(public_key).digest()
    # Chrome扩展ID是SHA256的前16字节转十六进制（32个字符），用a-p编码
    ext_id_bytes = sha256[:16]
    
    # Chrome使用特殊的a-p编码（不是0-9a-f）
    ext_id = ""
    for b in ext_id_bytes:
        ext_id += chr(ord('a') + (b >> 4)) + chr(ord('a') + (b & 0x0f))
    
    return key_b64, ext_id, private_key

def main():
    key_b64, ext_id, private_key = generate_rsa_key()
    
    print(f"生成的扩展key (Base64):")
    print(key_b64[:80] + "...")
    print(f"\n计算的扩展ID: {ext_id}")
    
    # 读取manifest
    manifest_path = os.path.join(EXT_DIR, "manifest.json")
    with open(manifest_path, 'r') as f:
        manifest = json.load(f)
    
    # 添加key
    manifest["key"] = key_b64
    
    # 写回manifest
    with open(manifest_path, 'w') as f:
        json.dump(manifest, f, indent=2, ensure_ascii=False)
    
    print(f"\n[*] manifest.json已更新，添加了key字段")
    print(f"[*] 新扩展ID: {ext_id}")
    
    # 保存私钥以备后用
    key_path = os.path.join(EXT_DIR, "extension_key.pem")
    with open(key_path, 'w') as f:
        f.write(private_key)
    print(f"[*] 私钥已保存到: {key_path}")
    
    return ext_id

if __name__ == "__main__":
    ext_id = main()
