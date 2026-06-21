# NZEB Deep-Retrofit Decision Platform

> **AI Agent hỗ trợ ra quyết định Cải tạo sâu Năng lượng tòa nhà** — hướng tới
> Thành phố Thông minh **Net-Zero Carbon 2050** tại TP. Hồ Chí Minh, cho mọi
> loại công trình (văn phòng / nhà ở / thương mại / hỗn hợp).
>
> _Agentic XAI · NSGA-III đa mục tiêu · QCVN 09:2017 + LEED v5 BD+C_

---

## 1. Hệ thống giải quyết bài toán gì?

Cải tạo sâu năng lượng (deep-energy retrofit) là bài toán **ra quyết định đa
tiêu chí**: chọn tổ hợp biện pháp nào, cường độ bao nhiêu, để cân bằng giữa
**năng lượng – chi phí – carbon** trong khi vẫn **tuân thủ tiêu chuẩn**.

Nền tảng tối ưu đồng thời **3 hàm mục tiêu**:

| Mục tiêu | Ý nghĩa | Đơn vị |
|----------|---------|--------|
| **f1 = EUI** | Cường độ sử dụng năng lượng vận hành | kWh/m²/năm |
| **f2 = LCC** | Chi phí vòng đời (NPV 25 năm: capex + năng lượng chiết khấu) | USD/m² |
| **f3 = WLC** | Carbon toàn vòng đời (embodied + vận hành) | kgCO₂e/m² |

Ràng buộc: tổng vốn đầu tư ≤ ngân sách. Đầu ra là **mặt Pareto** các phương án
tối ưu, cùng phương án **knee (cân bằng)** được khuyến nghị.

---

## 2. Kiến trúc (Enterprise, 2 tầng)

```
┌────────────────────────────────────────────────────────────┐
│  Next.js 16 (App Router)                                   │
│                                                            │
│   UI  ──►  /api/agent  ──►  AGENT HARNESS  (lib/harness)   │
│           (validation)      Claude Opus 4.8 tool-use loop  │
│                                  │                          │
│                                  ▼  3 tools                 │
│   ┌─ run_nsga3_optimization ─┐                              │
│   ├─ explain_design (XAI)    ├──HTTP──►  Decision Engine    │
│   └─ check_compliance        ┘          (FastAPI / Python)  │
└────────────────────────────────────────────────────────────┘
                                             │
                        ┌────────────────────┴───────────────┐
                        │  engine/  (Python)                  │
                        │   surrogate.py  — mô hình vật lý     │
                        │   optimize.py   — NSGA-III (pymoo)   │
                        │   compliance.py — QCVN + LEED rules  │
                        │   xai.py        — attribution        │
                        └─────────────────────────────────────┘
```

### Vì sao tách 2 tầng?
- **Tầng khoa học (Python)** dùng `pymoo` — thư viện NSGA-III chuẩn nghiên cứu
  (reference directions Das-Dennis), `numpy` cho mô hình vật lý. Deterministic,
  tái lập được, phù hợp công bố khoa học.
- **Tầng Agent (TypeScript/Next.js)** điều phối LLM, kiểm tra đầu vào, phục vụ UI.

---

## 3. Agent Harness — "Harness" thật, không phải prompt one-shot

`lib/harness/agent.ts` là một **vòng lặp tool-use thực sự**: Claude lập kế hoạch
→ gọi tool của engine → quan sát kết quả có cơ sở → lặp đến khi viết được khuyến
nghị. **Mọi con số trong khuyến nghị đều bắt nguồn từ kết quả tool**, LLM không
tự bịa.

Quy trình bắt buộc của agent:
1. `run_nsga3_optimization` → lấy mặt Pareto + phương án knee.
2. `explain_design` → XAI attribution cho phương án đó.
3. `check_compliance` → phán quyết QCVN/LEED.
4. Viết khuyến nghị có cấu trúc (gói biện pháp → giải thích → trade-off → tuân
   thủ → lộ trình Net-Zero).

Toàn bộ vết suy luận (tool calls) được hiển thị trên UI để **minh bạch & kiểm
chứng** (panel "Agent Harness — vết suy luận").

---

## 4. XAI — Giải thích được (model-faithful)

Vì surrogate là **mô hình vật lý hộp trắng**, ta tạo được giải thích *trung thực*
(không phải đoán hậu nghiệm) — `engine/xai.py`:

- **Waterfall** giảm EUI theo từng biện pháp (kWh/m²/năm).
- **Sensitivity** `dF/dx` — biến quyết định nào tác động mạnh nhất đến mỗi mục tiêu
  (sai phân hữu hạn tại điểm thiết kế, tương tự SHAP cho mô phỏng hộp trắng).
- **Phân bổ capex & embodied carbon** theo biện pháp.

LLM chỉ *diễn giải* các attribution này; không tạo ra chúng.

---

## 5. Compliance Engine — rule thật, deterministic

`engine/compliance.py` là **bộ luật**, không phải LLM đoán. Mỗi kiểm tra trả về
giá trị đo – ngưỡng – khoảng cách – điều khoản:

- **QCVN 09:2017/BXD**: phạm vi áp dụng (≥2500 m²), U-tường (OTTV), U-mái (RTTV),
  SHGC kính, COP HVAC tối thiểu, mật độ công suất chiếu sáng (LPD).
- **LEED v5 BD+C — Energy & Atmosphere**: điểm theo % cải thiện vận hành/carbon,
  năng lượng tái tạo, điện hóa, commissioning → ước tính hạng (Certified/Silver/Gold).

> ⚠️ Ngưỡng là **proxy kỹ thuật** bám cấu trúc công khai của từng tiêu chuẩn,
> minh bạch và có thể hiệu chỉnh; không thay thế hồ sơ mô phỏng năng lượng được
> chứng nhận.

---

## 6. Trực quan hóa NSGA-III

- **Scatter f1×f2, màu = f3 (WLC)**: thấy ngay đánh đổi EUI–LCC–carbon; ★ là
  phương án khuyến nghị, kèm các điểm cực trị (min-EUI / min-LCC / min-WLC).
- **Parallel coordinates** 3 trục: so sánh cấu trúc đánh đổi giữa các phương án.

---

## 7. Chạy hệ thống (demo)

Yêu cầu: Node ≥ 18, Python ≥ 3.9, biến môi trường `ANTHROPIC_API_KEY` trong
`.env.local`.

### Bước 1 — Decision Engine (Python)
```bash
cd engine
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt   # lần đầu
./run.sh        # khởi động FastAPI tại http://127.0.0.1:8000
```

### Bước 2 — Web + Agent (Next.js)
```bash
npm install     # lần đầu
npm run dev     # http://localhost:3000
```

Mở http://localhost:3000 → nhập hồ sơ tòa nhà → **Chạy Agent Harness**.

> Biến môi trường tùy chọn: `ENGINE_URL` (mặc định `http://127.0.0.1:8000`),
> `HARNESS_MODEL` (mặc định `claude-opus-4-8`).

---

## 8. Cấu trúc thư mục

```
nzeb-agent/
├── app/
│   ├── api/agent/route.ts        # endpoint gọi Agent Harness (có validation)
│   ├── components/
│   │   ├── ParetoChart.tsx        # scatter + parallel coordinates (SVG)
│   │   ├── XAIPanel.tsx           # waterfall + sensitivity + capex split
│   │   ├── CompliancePanel.tsx    # bảng QCVN + tín chỉ LEED
│   │   └── AgentTrace.tsx         # vết suy luận của harness
│   └── page.tsx                   # UI 3 bước, đa ngôn ngữ VI/KO/EN
├── lib/harness/
│   ├── agent.ts                   # vòng lặp tool-use (Claude Opus 4.8)
│   ├── tools.ts                   # định nghĩa & điều phối 3 tool
│   └── engine-client.ts           # client HTTP + kiểu dữ liệu engine
└── engine/                        # Python decision engine
    ├── surrogate.py · optimize.py · compliance.py · xai.py · main.py
    └── requirements.txt · run.sh
```

---

## 9. Hướng mở rộng (roadmap enterprise)

- Hạ tầng: SSO/RBAC, Postgres + lịch sử dự án, audit log, multi-tenant.
- Mô hình: tích hợp EnergyPlus để hiệu chỉnh surrogate; dữ liệu khí hậu TMY HCMC.
- Quy mô đô thị: nhập danh mục tòa nhà (portfolio), tối ưu phân bổ ngân sách cải
  tạo cấp thành phố hướng lộ trình Net-Zero 2050.
- Tiêu chuẩn: bổ sung EDGE, TCVN, và mô-đun đo lường & xác minh (M&V) IoT.
