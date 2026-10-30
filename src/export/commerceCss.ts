/**
 * Stylesheet for every e-commerce block the runtime renders.
 *
 * Scoped to `wb-shop*` / `wb-product*` / `wb-cod*` / `wb-admin*` class names so
 * it can never fight the page styles the builder produced.
 */
export const COMMERCE_CSS = `
.wb-shop{--wb-accent:#4f46e5;--wb-accent-ink:#fff;--wb-ok:#16a34a;--wb-warn:#d97706;--wb-bad:#dc2626;
  color:#0f172a;display:block}
.wb-shop *{box-sizing:border-box}
.wb-btn{display:inline-flex;align-items:center;justify-content:center;gap:.4rem;border:1px solid transparent;
  border-radius:.6rem;padding:.55rem .9rem;font:600 .82rem/1.2 inherit;cursor:pointer;transition:.15s;
  background:#e2e8f0;color:#0f172a}
.wb-btn:hover{filter:brightness(.96)}
.wb-btn:disabled{opacity:.5;cursor:not-allowed}
.wb-btn--primary{background:var(--wb-accent);color:var(--wb-accent-ink)}
.wb-btn--ghost{background:transparent;border-color:#cbd5e1;color:#334155}
.wb-btn--ghost:hover{border-color:var(--wb-accent);color:var(--wb-accent)}
.wb-btn--danger{background:#fee2e2;color:#b91c1c}
.wb-btn--sm{padding:.3rem .55rem;font-size:.72rem;border-radius:.45rem}
.wb-btn--block{width:100%}

/* toolbar + filters */
.wb-shop__toolbar{display:flex;flex-wrap:wrap;gap:.6rem;align-items:center;margin-bottom:1rem}
.wb-shop__cats{display:flex;flex-wrap:wrap;gap:.35rem}
.wb-shop__cat{border:1px solid #cbd5e1;background:#fff;border-radius:999px;padding:.3rem .75rem;font-size:.76rem;
  cursor:pointer;color:#475569}
.wb-shop__cat.is-active{background:var(--wb-accent);border-color:var(--wb-accent);color:#fff}
.wb-shop__field{display:flex;align-items:center;gap:.35rem;border:1px solid #cbd5e1;border-radius:.55rem;
  background:#fff;padding:.3rem .55rem;font-size:.78rem}
.wb-shop__field input,.wb-shop__field select{border:0;outline:0;font:inherit;background:transparent;min-width:0}
.wb-shop__count{font-size:.76rem;color:#64748b;margin-bottom:.7rem}
.wb-shop__grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(215px,1fr));gap:1rem}
.wb-shop__empty{padding:2rem;text-align:center;color:#64748b;border:1px dashed #cbd5e1;border-radius:.75rem}

/* product card */
.wb-product{display:flex;flex-direction:column;border:1px solid #e2e8f0;border-radius:.9rem;overflow:hidden;
  background:#fff;position:relative;transition:.18s}
.wb-product:hover{box-shadow:0 10px 26px -14px rgba(15,23,42,.35);transform:translateY(-2px)}
.wb-product__media{display:flex;align-items:center;justify-content:center;height:132px;font-size:3rem;text-decoration:none}
.wb-product__body{padding:.7rem .8rem .8rem;display:flex;flex-direction:column;gap:.3rem;flex:1}
.wb-product__badge{position:absolute;top:.5rem;left:.5rem;background:#0f172a;color:#fff;border-radius:999px;
  padding:.12rem .5rem;font-size:.64rem;font-weight:700}
.wb-product__badge.is-sale{background:#dc2626}
.wb-product__badge.is-new{background:#16a34a}
.wb-product__badge.is-low{background:#d97706}
.wb-product__name{font-size:.86rem;font-weight:700;margin:0;color:#0f172a;text-decoration:none;line-height:1.3}
.wb-product__blurb{font-size:.73rem;color:#64748b;margin:0;display:-webkit-box;-webkit-line-clamp:2;
  -webkit-box-orient:vertical;overflow:hidden}
.wb-product__meta{font-size:.68rem;color:#94a3b8}
.wb-product__price{display:flex;align-items:baseline;gap:.4rem;margin-top:auto}
.wb-product__price b{font-size:1rem;color:#0f172a}
.wb-product__price s{font-size:.72rem;color:#94a3b8}
.wb-product__price em{font-size:.68rem;color:#dc2626;font-style:normal;font-weight:700}
.wb-product__actions{display:flex;gap:.35rem;margin-top:.45rem}
.wb-product__actions .wb-btn{flex:1}
.wb-product__stock{font-size:.66rem;color:#16a34a}
.wb-product__stock.is-low{color:#d97706}
.wb-product__stock.is-out{color:#dc2626}

/* stars */
.wb-stars{color:#f59e0b;letter-spacing:1px}

/* product detail */
.wb-detail{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:1.5rem}
.wb-detail__media{display:flex;align-items:center;justify-content:center;border-radius:1rem;font-size:7rem;min-height:280px}
.wb-detail__price{display:flex;align-items:baseline;gap:.6rem;font-size:1.6rem;font-weight:800}
.wb-detail__specs{width:100%;border-collapse:collapse;font-size:.8rem;margin-top:.6rem}
.wb-detail__specs th,.wb-detail__specs td{border:1px solid #e2e8f0;padding:.4rem .6rem;text-align:left}
.wb-detail__specs th{background:#f8fafc;width:40%;font-weight:600}
.wb-qty{display:inline-flex;align-items:center;border:1px solid #cbd5e1;border-radius:.55rem;overflow:hidden}
.wb-qty button{width:30px;height:30px;border:0;background:#f1f5f9;cursor:pointer;font-weight:700}
.wb-qty span{min-width:38px;text-align:center;font-size:.82rem;font-weight:700}

/* cart + checkout layout */
.wb-panel{border:1px solid #e2e8f0;border-radius:.85rem;background:#fff;padding:1rem;margin-bottom:1rem}
.wb-panel__title{font-weight:800;font-size:.95rem;margin:0 0 .7rem;display:flex;justify-content:space-between;align-items:center}
.wb-lines{display:flex;flex-direction:column;gap:.6rem}
.wb-line{display:grid;grid-template-columns:52px minmax(0,1fr) auto;gap:.7rem;align-items:center;
  border:1px solid #e2e8f0;border-radius:.7rem;padding:.55rem}
.wb-line__media{width:52px;height:52px;border-radius:.5rem;display:flex;align-items:center;justify-content:center;font-size:1.6rem}
.wb-line__name{font-weight:700;font-size:.84rem;text-decoration:none;color:#0f172a}
.wb-line__sku{font-size:.68rem;color:#94a3b8}
.wb-line__price{text-align:right;font-weight:700;font-size:.86rem}
.wb-totals{margin-left:auto;width:min(320px,100%);font-size:.84rem}
.wb-totals div{display:flex;justify-content:space-between;padding:.2rem 0}
.wb-totals .is-total{border-top:1px solid #e2e8f0;margin-top:.35rem;padding-top:.5rem;font-size:1rem;font-weight:800}
.wb-coupon{display:flex;gap:.4rem;margin-top:.6rem}
.wb-coupon input{flex:1;border:1px solid #cbd5e1;border-radius:.55rem;padding:.45rem .6rem;font:inherit;font-size:.8rem}
.wb-two{display:grid;grid-template-columns:minmax(0,1.6fr) minmax(0,1fr);gap:1.2rem;align-items:start}
@media (max-width:820px){.wb-two,.wb-detail{grid-template-columns:minmax(0,1fr)}}

/* forms */
.wb-form{display:grid;gap:.75rem}
.wb-form__grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:.75rem}
.wb-form__row{display:flex;flex-direction:column;gap:.25rem}
.wb-form__row label{font-size:.74rem;font-weight:700;color:#334155}
.wb-form__row label span{color:#dc2626}
.wb-form__row input,.wb-form__row select,.wb-form__row textarea{
  border:1px solid #cbd5e1;border-radius:.55rem;padding:.5rem .6rem;font:inherit;font-size:.82rem;background:#fff}
.wb-form__row input:focus,.wb-form__row select:focus,.wb-form__row textarea:focus{
  outline:2px solid rgba(79,70,229,.25);border-color:#4f46e5}
.wb-form__row.is-error input,.wb-form__row.is-error select,.wb-form__row.is-error textarea{border-color:#dc2626}
.wb-form__err{font-size:.7rem;color:#dc2626;min-height:.9rem}
.wb-form__note{font-size:.72rem;color:#64748b}
.wb-form__check{display:flex;gap:.5rem;align-items:flex-start;font-size:.78rem;color:#334155}
.wb-form__check input{width:auto}
.wb-choice{display:flex;gap:.6rem;align-items:flex-start;border:1px solid #cbd5e1;border-radius:.7rem;
  padding:.6rem .7rem;cursor:pointer;background:#fff}
.wb-choice.is-active{border-color:#4f46e5;box-shadow:0 0 0 2px rgba(79,70,229,.12)}
.wb-choice input{width:auto}
.wb-choice__t{font-weight:700;font-size:.82rem}
.wb-choice__h{font-size:.72rem;color:#64748b}
.wb-alert{border-radius:.6rem;padding:.6rem .75rem;font-size:.8rem;margin-bottom:.7rem}
.wb-alert--error{background:#fef2f2;color:#b91c1c;border:1px solid #fecaca}
.wb-alert--ok{background:#f0fdf4;color:#15803d;border:1px solid #bbf7d0}
.wb-alert--info{background:#eff6ff;color:#1d4ed8;border:1px solid #bfdbfe}
.wb-alert--warn{background:#fffbeb;color:#b45309;border:1px solid #fde68a}

/* COD block */
.wb-cod{border:2px solid #0f766e;border-radius:.9rem;background:#f0fdfa;padding:.9rem}
.wb-cod__title{font-weight:800;color:#0f766e;margin:0 0 .3rem;display:flex;align-items:center;gap:.4rem}
.wb-cod__amount{font-size:1.7rem;font-weight:900;color:#0f766e}
.wb-cod__grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:.75rem}
.wb-cod__hint{font-size:.74rem;color:#0f766e}

/* timeline */
.wb-timeline{list-style:none;margin:.6rem 0 0;padding:0;display:flex;flex-direction:column;gap:.4rem}
.wb-timeline li{display:flex;gap:.6rem;align-items:center;font-size:.78rem;padding:.35rem .5rem;border-radius:.5rem;
  background:#f8fafc;color:#64748b}
.wb-timeline li.is-done{background:#f0fdf4;color:#15803d}
.wb-timeline li.is-now{background:#eff6ff;color:#1d4ed8;font-weight:700}
.wb-dot{width:10px;height:10px;border-radius:50%;background:#cbd5e1;flex:0 0 auto}
.wb-timeline li.is-done .wb-dot{background:#16a34a}
.wb-timeline li.is-now .wb-dot{background:#3b82f6}

/* status pills */
.wb-pill{display:inline-block;border-radius:999px;padding:.12rem .55rem;font-size:.68rem;font-weight:700;color:#fff}
.wb-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:.6rem;margin-bottom:1rem}
.wb-kpi{border:1px solid #e2e8f0;border-radius:.7rem;padding:.6rem .7rem;background:#fff}
.wb-kpi b{display:block;font-size:1.2rem;line-height:1.2}
.wb-kpi span{font-size:.68rem;color:#64748b;text-transform:uppercase;letter-spacing:.04em}
.wb-table-wrap{overflow:auto;border:1px solid #e2e8f0;border-radius:.7rem;background:#fff}
.wb-table{width:100%;border-collapse:collapse;font-size:.78rem}
.wb-table th,.wb-table td{padding:.45rem .55rem;border-bottom:1px solid #e2e8f0;text-align:left;white-space:nowrap}
.wb-table th{background:#f8fafc;font-weight:700;position:sticky;top:0}
.wb-table tr:last-child td{border-bottom:0}
.wb-bars{display:flex;align-items:flex-end;gap:.3rem;height:80px}
.wb-bars div{flex:1;background:#c7d2fe;border-radius:3px 3px 0 0;min-height:2px;position:relative}
.wb-bars div.is-top{background:#4f46e5}
.wb-tabs{display:flex;gap:.3rem;flex-wrap:wrap;border-bottom:1px solid #e2e8f0;margin-bottom:.8rem}
.wb-tabs button{border:0;background:transparent;padding:.45rem .7rem;font:600 .8rem inherit;cursor:pointer;
  color:#64748b;border-bottom:2px solid transparent}
.wb-tabs button.is-active{color:#4f46e5;border-bottom-color:#4f46e5}
.wb-drawer{position:fixed;inset:0;background:rgba(15,23,42,.45);display:flex;justify-content:flex-end;z-index:9999}
.wb-drawer__body{background:#fff;width:min(460px,100%);height:100%;overflow:auto;padding:1rem}
.wb-rev{border:1px solid #e2e8f0;border-radius:.6rem;padding:.55rem .65rem;margin-bottom:.5rem;font-size:.8rem}
.wb-rev__who{font-weight:700;font-size:.76rem}
.wb-locked{max-width:420px;margin:0 auto;text-align:center;border:1px dashed #cbd5e1;border-radius:.9rem;padding:1.2rem}
.wb-toast{position:fixed;right:1rem;bottom:1rem;background:#0f172a;color:#fff;padding:.6rem .9rem;border-radius:.6rem;
  font-size:.8rem;z-index:10000;box-shadow:0 12px 30px -12px rgba(0,0,0,.6)}
.wb-cart-bar{position:sticky;bottom:0;display:flex;gap:.6rem;align-items:center;justify-content:space-between;
  border-top:1px solid #e2e8f0;background:#fff;padding:.7rem 0;margin-top:.8rem}
@media (max-width:767px){
  .wb-shop__grid{grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:.6rem}
  .wb-product__media{height:110px;font-size:2.2rem}
  .wb-product__body{padding:.5rem .6rem}
  .wb-product__name{font-size:.8rem}
  .wb-product__price b{font-size:.9rem}
  .wb-shop__toolbar{gap:.4rem}
  .wb-line{grid-template-columns:44px minmax(0,1fr) auto;gap:.5rem;padding:.45rem}
  .wb-detail__media{min-height:200px;font-size:4.5rem}
  .wb-drawer__body{width:100%;max-width:100%}
  .wb-form__grid{grid-template-columns:minmax(0,1fr)}
  .wb-kpis{grid-template-columns:repeat(2,minmax(0,1fr))}
}
@media print{.wb-shop__toolbar,.wb-btn,.wb-tabs,.wb-noprint{display:none!important}}
`.trim();