# DeepSeek V4 Pro 1M Reading Extraction Prompt

Use the configured DeepSeek V4 Pro profile with max reasoning effort and the 1M context window.
The task is not generic summary. Produce structured reading artifacts that can improve a long-form novel agent.

Batch: batch-001
Objective: Establish the first bilingual comparative pass: English plot/scene craft, Chinese fate-world-relationship logic, and public-domain craft vocabulary.

For each source, read the local full text and fill the artifact sections already generated for that source.
Do not copy long passages. Quote only tiny phrases when necessary for evidence.

Extraction priorities:

1. Preserve cross-chapter causality and delayed payoff.
2. Extract reusable craft rules without imitating prose.
3. Track world logic, social pressure, relationship debt, fate signals, and taboo rules.
4. Convert findings into WorldDaemon, SimulationRun, CanonGate, and Memory inputs.
5. Mark uncertain claims instead of inventing evidence.

Batch sources:

## 1. Frankenstein; Or, The Modern Prometheus

- queue_id: fiction_en:frankenstein
- author: Mary Wollstonecraft Shelley
- language: en
- source_path: corpus/raw/gutenberg/frankenstein.txt
- artifact_path: corpus/derived/reading-artifacts/first-pass/fiction_en-frankenstein.md

## 2. Moby-Dick; Or, The Whale

- queue_id: fiction_en:moby-dick
- author: Herman Melville
- language: en
- source_path: corpus/raw/gutenberg/moby-dick.txt
- artifact_path: corpus/derived/reading-artifacts/first-pass/fiction_en-moby-dick.md

## 3. Pride and Prejudice

- queue_id: fiction_en:pride-and-prejudice
- author: Jane Austen
- language: en
- source_path: corpus/raw/gutenberg/pride-and-prejudice.txt
- artifact_path: corpus/derived/reading-artifacts/first-pass/fiction_en-pride-and-prejudice.md

## 4. Crime and Punishment

- queue_id: fiction_en:crime-and-punishment
- author: Fyodor Dostoyevsky
- language: en
- source_path: corpus/raw/gutenberg/crime-and-punishment.txt
- artifact_path: corpus/derived/reading-artifacts/first-pass/fiction_en-crime-and-punishment.md

## 5. Jane Eyre

- queue_id: fiction_en:jane-eyre
- author: Charlotte Bronte
- language: en
- source_path: corpus/raw/gutenberg/jane-eyre.txt
- artifact_path: corpus/derived/reading-artifacts/first-pass/fiction_en-jane-eyre.md

## 6. Dracula

- queue_id: fiction_en:dracula
- author: Bram Stoker
- language: en
- source_path: corpus/raw/gutenberg/dracula.txt
- artifact_path: corpus/derived/reading-artifacts/first-pass/fiction_en-dracula.md

## 7. Little Women

- queue_id: fiction_en:little-women
- author: Louisa May Alcott
- language: en
- source_path: corpus/raw/gutenberg/little-women.txt
- artifact_path: corpus/derived/reading-artifacts/first-pass/fiction_en-little-women.md

## 8. Adventures of Huckleberry Finn

- queue_id: fiction_en:huckleberry-finn
- author: Mark Twain
- language: en
- source_path: corpus/raw/gutenberg/huckleberry-finn.txt
- artifact_path: corpus/derived/reading-artifacts/first-pass/fiction_en-huckleberry-finn.md

## 9. 紅樓夢

- queue_id: fiction_zh:hongloumeng
- author: 曹雪芹
- language: zh
- source_path: corpus/raw/gutenberg-zh/hongloumeng.txt
- artifact_path: corpus/derived/reading-artifacts/first-pass/fiction_zh-hongloumeng.md

## 10. 三國志演義

- queue_id: fiction_zh:sanguozhiyanyi
- author: 羅貫中
- language: zh
- source_path: corpus/raw/gutenberg-zh/sanguozhiyanyi.txt
- artifact_path: corpus/derived/reading-artifacts/first-pass/fiction_zh-sanguozhiyanyi.md

## 11. 水滸傳

- queue_id: fiction_zh:shuihuzhuan
- author: 施耐庵
- language: zh
- source_path: corpus/raw/gutenberg-zh/shuihuzhuan.txt
- artifact_path: corpus/derived/reading-artifacts/first-pass/fiction_zh-shuihuzhuan.md

## 12. 西遊記

- queue_id: fiction_zh:xiyouji
- author: 吳承恩
- language: zh
- source_path: corpus/raw/gutenberg-zh/xiyouji.txt
- artifact_path: corpus/derived/reading-artifacts/first-pass/fiction_zh-xiyouji.md

## 13. 封神演義

- queue_id: fiction_zh:fengshenyanyi
- author: 陸西星
- language: zh
- source_path: corpus/raw/gutenberg-zh/fengshenyanyi.txt
- artifact_path: corpus/derived/reading-artifacts/first-pass/fiction_zh-fengshenyanyi.md

## 14. 儒林外史

- queue_id: fiction_zh:rulinwaishi
- author: 吳敬梓
- language: zh
- source_path: corpus/raw/gutenberg-zh/rulinwaishi.txt
- artifact_path: corpus/derived/reading-artifacts/first-pass/fiction_zh-rulinwaishi.md

## 15. 鏡花緣

- queue_id: fiction_zh:jinghuayuan
- author: 李汝珍
- language: zh
- source_path: corpus/raw/gutenberg-zh/jinghuayuan.txt
- artifact_path: corpus/derived/reading-artifacts/first-pass/fiction_zh-jinghuayuan.md

## 16. 兒女英雄傳

- queue_id: fiction_zh:ernvyingxiongzhuan
- author: 文康
- language: zh
- source_path: corpus/raw/gutenberg-zh/ernvyingxiongzhuan.txt
- artifact_path: corpus/derived/reading-artifacts/first-pass/fiction_zh-ernvyingxiongzhuan.md

## 17. Poetics

- queue_id: craft:craft-001
- author: Aristotle
- language: mixed
- source_path: corpus/raw/writing-craft/poetics-aristotle.txt
- artifact_path: corpus/derived/reading-artifacts/first-pass/craft-craft-001.md

## 18. Ars Poetica

- queue_id: craft:craft-003
- author: Horace
- language: mixed
- source_path: corpus/raw/writing-craft/art-of-poetry-horace.txt
- artifact_path: corpus/derived/reading-artifacts/first-pass/craft-craft-003.md

## 19. On the Sublime

- queue_id: craft:craft-004
- author: Longinus
- language: mixed
- source_path: corpus/raw/writing-craft/on-the-sublime-longinus.txt
- artifact_path: corpus/derived/reading-artifacts/first-pass/craft-craft-004.md

## 20. The Art of Fiction

- queue_id: craft:craft-005
- author: Henry James
- language: mixed
- source_path: corpus/raw/writing-craft/partial-portraits-art-of-fiction-henry-james.txt
- artifact_path: corpus/derived/reading-artifacts/first-pass/craft-craft-005.md

