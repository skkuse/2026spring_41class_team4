# Upload validation fixtures

`POST /subjects/:subjectId/documents/upload` 파일 검증 테스트용 자산.
2026-06-05 라이브 검증에 사용됨 — 결과는 `test/integration/document-upload-validation.int-spec.ts` 참고.

| 파일 | 실제 형식 (magic number) | 기대 결과 |
|---|---|---|
| `test_01_large.pdf` | PDF 1.7, 22MB (**git ignore — 로컬 전용**) | 50MB 미만 → 201 |
| `test_01_void.pdf` | 빈 파일 (0 byte) | 400 |
| `test_02.pptx` | PowerPoint 2007+ | 400 |
| `test_03.txt` | ASCII text | 400 |
| `test_04.png` | PNG | 400 |
| `test_05.jpeg` | **PNG** (확장자만 jpeg — 자연 스푸핑) | 400 |
| `test_06.docx` / `test_06_filed.docx` | Word 2007+ | 400 |
| `test_07.zip` / `test_07_filed.zip` | Zip | 400 |
| `test_08.hwp` | HWP 5.x | 400 |
| `test_09.mp4` | MP4 v2 | 400 |
| `test_10.md` | ASCII text | 400 |
| `test_11.xlsx` | Excel 2007+ | 400 |

- 어떤 파일이든 Content-Type을 `application/pdf`로 스푸핑해도 400이어야 함 (FileTypeValidator는 내용 기반).
- 50MB 초과 케이스는 fixture로 두기엔 너무 커서 테스트에서 동적 생성 권장: `dd if=/dev/zero of=big.pdf bs=1M count=51`.
