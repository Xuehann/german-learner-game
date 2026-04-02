# 德语沉浸式学习游戏

## 已实现功能
- 英文词展示 -> 输入德语 -> 判定
- 仅答对触发切香肠成功动画（1.2s）
- 答错立即显示正确答案与用户输入
- 学习单元系统（创建/切换/重命名/删除）
- JSON 词库上传（每次上传创建独立学习单元）
- AI 文本生成词库（`POST /api/units/generate` 后端代理）
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
    "pastTense": "aß"
  }
]
```

说明：
- 必填字段：`id`, `english`, `german`, `category`
- 可选字段：`pastTense`
- 旧字段 `difficulty` 若存在会被自动忽略，不会报错

可直接参考 [`public/sample-words.json`](./public/sample-words.json)。
