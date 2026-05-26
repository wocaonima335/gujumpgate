#!/bin/bash
# GuJumpgate 服务器端运行脚本
# 使用 xvfb 虚拟显示 + Chrome 加载扩展
# 
# 用法:
#   bash run-server.sh                          # 交互模式，启动后手动操作
#   bash run-server.sh --auto                    # 自动模式，自动启动注册流程

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
EXTENSION_PATH="$SCRIPT_DIR"
USER_DATA_DIR="/tmp/chrome-gujumpgate"
DEBUG_PORT=9222
DISPLAY_NUM=125

# 清理旧进程
cleanup() {
  echo "[Runner] 清理中..."
  # 关闭Chrome
  pkill -f "chrome.*gujumpgate" 2>/dev/null || true
  # 关闭Xvfb
  pkill -f "Xvfb :${DISPLAY_NUM}" 2>/dev/null || true
  echo "[Runner] 已清理"
}
trap cleanup EXIT

echo "============================================"
echo "  GuJumpgate 服务器端运行器 v0.1"
echo "============================================"
echo ""
echo "扩展路径: $EXTENSION_PATH"
echo "数据目录: $USER_DATA_DIR"
echo "调试端口: $DEBUG_PORT"
echo ""

# 1. 确保Helper在运行
if curl -s -m 2 -X POST http://127.0.0.1:17373/save-auth-json -H "Content-Type: application/json" -d '{}' 2>&1 | grep -q "ok"; then
  echo "[✓] Hotmail Helper 运行中 (port 17373)"
else
  echo "[!] Hotmail Helper 未运行，尝试启动..."
  systemctl start gujumpgate-helper 2>/dev/null && echo "[✓] Helper 已启动" || echo "[✗] Helper 启动失败"
fi

# 2. 确保mihomo代理在运行
if curl -s -m 2 http://127.0.0.1:9090/version 2>&1 | grep -q "meta"; then
  echo "[✓] Mihomo 代理运行中 (port 9090)"
else
  echo "[✗] Mihomo 代理未运行！请先启动 mihomo"
  exit 1
fi

# 3. 检查分流规则
GPT_PAY=$(curl -s http://127.0.0.1:9090/proxies 2>/dev/null | python3 -c "
import json,sys
try:
  data=json.load(sys.stdin)
  p=data.get('proxies',{}).get('GPT支付分流',{})
  print(f\"type={p.get('type','?')}, now={p.get('now','?')}, nodes={len(p.get('all',[]))}\")
except: print('NOT_FOUND')
" 2>/dev/null)
GPT_REG=$(curl -s http://127.0.0.1:9090/proxies 2>/dev/null | python3 -c "
import json,sys
try:
  data=json.load(sys.stdin)
  p=data.get('proxies',{}).get('GPT注册分流',{})
  print(f\"type={p.get('type','?')}, now={p.get('now','?')}, nodes={len(p.get('all',[]))}\")
except: print('NOT_FOUND')
" 2>/dev/null)
echo "[i] GPT支付分流: $GPT_PAY"
echo "[i] GPT注册分流: $GPT_REG"
echo ""

# 4. 清理旧数据目录
rm -rf "$USER_DATA_DIR"
mkdir -p "$USER_DATA_DIR"

# 5. 启动虚拟显示
echo "[Runner] 启动虚拟显示 :${DISPLAY_NUM}..."
Xvfb :${DISPLAY_NUM} -screen 0 1280x800x24 -ac &
XVFB_PID=$!
sleep 1

# 6. 启动Chrome（带扩展、带代理）
echo "[Runner] 启动 Chrome..."
export DISPLAY=:${DISPLAY_NUM}

google-chrome \
  --no-sandbox \
  --disable-gpu \
  --disable-dev-shm-usage \
  --user-data-dir="$USER_DATA_DIR" \
  --load-extension="$EXTENSION_PATH" \
  --disable-extensions-except="$EXTENSION_PATH" \
  --remote-debugging-port=$DEBUG_PORT \
  --proxy-server="http://127.0.0.1:10809" \
  --window-size=1280,800 \
  --enable-features=SidePanel \
  --no-first-run \
  --disable-features=Translate \
  "https://chatgpt.com" &

CHROME_PID=$!
echo "[Runner] Chrome PID: $CHROME_PID"
echo ""

# 7. 等待Chrome启动
sleep 5

# 8. 检查Chrome是否运行
if curl -s -m 2 http://127.0.0.1:$DEBUG_PORT/json/version 2>&1 | grep -q "Browser"; then
  echo "[✓] Chrome 运行中，调试端口: $DEBUG_PORT"
else
  echo "[✗] Chrome 启动失败"
  exit 1
fi

echo ""
echo "============================================"
echo "  Chrome 已启动，扩展已加载！"
echo "============================================"
echo ""
echo "操作方式："
echo "  1. 通过 VNC/远程桌面连接到本机"
echo "  2. 或通过 CDP 协议远程控制："
echo "     ws://<IP>:$DEBUG_PORT/devtools/browser/..."
echo ""
echo "  查看当前标签页："
echo "    curl http://127.0.0.1:$DEBUG_PORT/json/list"
echo ""
echo "  扩展sidePanel需要手动打开："
echo "    点击Chrome工具栏中的GuJumpgate图标"
echo ""

# 如果是自动模式，通过CDP发送消息
if [[ "${1:-}" == "--auto" ]]; then
  echo "[Runner] 自动模式：尝试通过CDP启动注册流程..."
  
  # 获取扩展ID
  EXT_ID=$(curl -s http://127.0.0.1:$DEBUG_PORT/json/list 2>/dev/null | python3 -c "
import json,sys
try:
  tabs=json.load(sys.stdin)
  for t in tabs:
    url=t.get('url','')
    if url.startswith('chrome-extension://'):
      print(url.split('/')[2])
      break
except: pass
" 2>/dev/null)
  
  if [[ -n "$EXT_ID" ]]; then
    echo "[Runner] 扩展ID: $EXT_ID"
    
    # 打开sidepanel页面
    SIDE_URL="chrome-extension://${EXT_ID}/sidepanel/sidepanel.html"
    echo "[Runner] SidePanel URL: $SIDE_URL"
    
    # 通过CDP创建新标签页打开sidepanel
    WS_URL=$(curl -s http://127.0.0.1:$DEBUG_PORT/json/version 2>/dev/null | python3 -c "
import json,sys
data=json.load(sys.stdin)
print(data.get('webSocketDebuggerUrl',''))
" 2>/dev/null)
    
    echo "[Runner] WebSocket: $WS_URL"
    echo "[Runner] 请通过CDP协议连接并操作sidepanel"
  else
    echo "[Runner] 未检测到扩展ID"
  fi
fi

# 保持运行
echo ""
echo "[Runner] Chrome 保持运行中... Ctrl+C 退出"
wait $CHROME_PID 2>/dev/null || wait