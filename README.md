# 德国肉铺切香肠 - 德语学习游戏

## 已实现功能
- 英文词展示 -> 输入德语 -> 判定
- 仅答对触发切香肠成功动画（1.2s）
- 答错立即显示正确答案与用户输入，1.5s 自动下一题
- 无分数、无连击、无倒计时
- JSON 词库上传（仅 JSON）
- 本地持久化：设置、单词进度、会话历史
- 德语输入辅助：Alt+A/O/U/S 与虚拟键盘 `ä ö ü ß`

## 启动
```bash
npm install
npm run dev
```

## 测试
```bash
npm test
```

## JSON 词库格式
```json
[
  {
    "id": "custom-001",
    "english": "apple",
    "german": "der Apfel",
    "category": "food",
    "difficulty": "A1"
  }
]
```

可直接参考 [`public/sample-words.json`](./public/sample-words.json)。
