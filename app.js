const CSV_URL = "./data/products.csv";
const DETAILS_URL = "./data/drug-details.json";
const SEED_URL = "./data/seed-products.json";
const SUPABASE_URL = "https://ulmwnhzxuchreyyizazi.supabase.co";
const SUPABASE_KEY = "sb_publishable_4QXydl9WrLiJUem__dVJPA_IwVVAUlT";
const SYNC_INTERVAL_MS = 12000;
const STORE_STOCK_ON = "재고 있음";
const STORE_STOCK_OFF = "재고 없음";
const WAREHOUSE_STOCK_ON = "창고에 재고 있음";
const WAREHOUSE_STOCK_OFF = "창고에 재고 없음";

const SHELF_CATEGORIES = [
  { value: "해열진통소염제", location: "1-L" },
  { value: "안과용제 및 인공눈물", location: "1-L" },
  { value: "우황청심원", location: "1-R" },
  { value: "수면유도제", location: "1-R" },
  { value: "근육이완제", location: "1-R" },
  { value: "외용진통제(타박상)", location: "1-R" },
  { value: "연고류 일반", location: "2-L" },
  { value: "여성질환치료제", location: "2-L" },
  { value: "경구피임약", location: "2-L" },
  { value: "임신진단테스트기", location: "2-L" },
  { value: "일반밴드", location: "2-R" },
  { value: "항진균제(무좀)", location: "3-L" },
  { value: "구강질환용제", location: "3-L" },
  { value: "멀미약", location: "3-L" },
  { value: "구충제", location: "3-L" },
  { value: "습윤밴드", location: "3-R" },
  { value: "항히스타민제", location: "4-L" },
  { value: "알러지", location: "4-L" },
  { value: "동물용 의약품", location: "4-R" },
  { value: "치아 구강용제", location: "5-L" },
  { value: "여성 건강기능식품(항산화, 갱년기 완화, 부종 개선)", location: "5-R" },
  { value: "한방 감기약", location: "6-L" },
  { value: "위장약", location: "6-R" },
  { value: "소화제", location: "6-R" },
  { value: "특수 한방제제", location: "7-L" },
  { value: "지사제", location: "7-R" },
  { value: "변비약", location: "7-R" },
  { value: "관장약", location: "7-R" },
  { value: "감기약1", location: "8-L" },
  { value: "감기약2", location: "8-R" },
  { value: "치질약", location: "9-L" },
  { value: "지루성피부염(비듬)", location: "9-L" },
  { value: "특수 한방제제", location: "9-R" },
  { value: "어린이의약품", location: "10-L" },
  { value: "어린이의약품", location: "10-R" },
  { value: "염색약", location: "11-L" },
  { value: "다한증치료제", location: "11-L" },
  { value: "여름용품", location: "11-L" },
  { value: "구강 및 입술 케어", location: "11-R" },
  { value: "금연보조제", location: "11-R" },
  { value: "소독용 에탄올 및 살균소독제", location: "12-L" },
  { value: "어린이의약품", location: "12-R" },
  { value: "의약외품", location: "13-L" },
  { value: "의약외품", location: "13-R" },
  { value: "파스", location: "PS" },
  { value: "드링크", location: "DR" },
];

const CATEGORY_LOCATION = new Map();
for (const item of SHELF_CATEGORIES) {
  if (!CATEGORY_LOCATION.has(item.value)) CATEGORY_LOCATION.set(item.value, item.location);
}

const state = {
  products: [],
  selectedId: null,
  shelfFilter: "",
  categoryFilter: "",
  detailTab: "description",
  syncTimer: null,
  lastLoadedAt: null,
};

const $ = (selector) => document.querySelector(selector);

const els = {
  summary: $("#summary"),
  appMain: $("#appMain"),
  syncStatus: $("#syncStatus"),
  seedBtn: $("#seedBtn"),
  addProductBtn: $("#addProductBtn"),
  searchInput: $("#searchInput"),
  categoryTabs: $("#categoryTabs"),
  locationFilter: $("#locationFilter"),
  stockFilter: $("#stockFilter"),
  results: $("#results"),
  template: $("#resultTemplate"),
  form: $("#detailForm"),
  exportBtn: $("#exportBtn"),
  importInput: $("#importInput"),
  imageBox: $(".image-box"),
  drugImage: $("#drugImage"),
  imageFallback: $("#imageFallback"),
  detailTitle: $("#detailTitle"),
  detailCategory: $("#detailCategory"),
  descriptionView: $("#descriptionView"),
  factLocation: $("#factLocation"),
  factStock: $("#factStock"),
  factOfficialName: $("#factOfficialName"),
  factManufacturer: $("#factManufacturer"),
  factPrice: $("#factPrice"),
  factSource: $("#factSource"),
  factDescription: $("#factDescription"),
  factOfficialBadge: $("#factOfficialBadge"),
  matchNotice: $("#matchNotice"),
};

const fields = {
  name: $("#nameField"),
  officialName: $("#officialNameField"),
  location: $("#locationField"),
  stock: $("#stockField"),
  warehouseStock: $("#warehouseStockField"),
  category: $("#categoryField"),
  price: $("#priceField"),
  manufacturer: $("#manufacturerField"),
  imageUrl: $("#imageUrlField"),
  sourceUrl: $("#sourceUrlField"),
  description: $("#descriptionField"),
  imageFile: $("#imageFileField"),
};

function parseCsv(text) {
  const rows = [];
  let row = [];
  let value = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"' && inQuotes && next === '"') {
      value += '"';
      i += 1;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      row.push(value);
      value = "";
    } else if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") i += 1;
      row.push(value);
      if (row.some((cell) => cell.trim() !== "")) rows.push(row);
      row = [];
      value = "";
    } else {
      value += char;
    }
  }

  if (value || row.length) {
    row.push(value);
    rows.push(row);
  }

  const headers = rows.shift().map((header) => header.replace(/^\uFEFF/, "").trim());
  return rows.map((cells) =>
    Object.fromEntries(headers.map((header, index) => [header, (cells[index] || "").trim()])),
  );
}

function authHeaders(extra = {}) {
  return {
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${SUPABASE_KEY}`,
    ...extra,
  };
}

async function supabaseFetch(path, options = {}) {
  const response = await fetch(`${SUPABASE_URL}${path}`, {
    ...options,
    headers: {
      ...authHeaders(options.headers || {}),
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Supabase request failed: ${response.status}`);
  }

  if (response.status === 204) return null;
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

function showApp() {
  els.appMain.classList.remove("hidden");
  els.exportBtn.classList.remove("hidden");
  els.syncStatus.textContent = "Supabase 연결됨";
}

function startSync() {
  stopSync();
  state.syncTimer = window.setInterval(() => {
    loadProductsFromSupabase({ preserveSelection: true, quiet: true }).catch((error) => {
      console.error(error);
      els.syncStatus.textContent = "동기화 실패";
    });
  }, SYNC_INTERVAL_MS);
}

function stopSync() {
  if (state.syncTimer) window.clearInterval(state.syncTimer);
  state.syncTimer = null;
}

function normalizeForSearch(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[()\[\]{}·ㆍ\-\s]/g, "");
}

function initialLocation(category) {
  if (category.includes("파스")) return "PS";
  if (category.includes("드링크")) return "DR";
  if (CATEGORY_LOCATION.has(category)) return CATEGORY_LOCATION.get(category);
  return "";
}

function normalizeStoreStock(value) {
  if (value === "있음" || value === STORE_STOCK_ON) return STORE_STOCK_ON;
  if (value === "없음" || value === STORE_STOCK_OFF) return STORE_STOCK_OFF;
  return value || STORE_STOCK_ON;
}

function normalizeWarehouseStock(value) {
  if (value === WAREHOUSE_STOCK_ON || value === "있음") return WAREHOUSE_STOCK_ON;
  if (value === WAREHOUSE_STOCK_OFF || value === "없음") return WAREHOUSE_STOCK_OFF;
  return value || WAREHOUSE_STOCK_OFF;
}

function stockIsOn(value, type = "store") {
  return type === "warehouse" ? value === WAREHOUSE_STOCK_ON : value === STORE_STOCK_ON;
}

function categoryLabel(category) {
  return category.replace(/^[^\p{L}\p{N}]+/u, "").trim() || "미분류";
}

function categoryColor(category) {
  const palette = [
    "#5eead4",
    "#93c5fd",
    "#fbbf24",
    "#f9a8d4",
    "#c4b5fd",
    "#67e8f9",
    "#fb7185",
    "#bef264",
    "#d8b4fe",
    "#fdba74",
    "#99f6e4",
    "#bfdbfe",
  ];
  let hash = 0;
  for (const char of category) hash = (hash * 31 + char.charCodeAt(0)) % 9973;
  return palette[hash % palette.length];
}

function createProducts(rows) {
  return rows.map((row, index) => {
    const category = row["카테고리"] || "";
    const name = row["약품명"] || "";

    return {
      id: `drug-${index + 1}`,
      name,
      officialName: "",
      category,
      price: row["가격(원)"] || "",
      stock: normalizeStoreStock(row["재고"] || ""),
      warehouseStock: WAREHOUSE_STOCK_OFF,
      manufacturer: row["제약회사"] || "",
      location: initialLocation(category),
      description: "",
      imageUrl: "",
      sourceUrl: "",
      updatedAt: "",
    };
  });
}

function mergeOfficialDetails(baseProducts, detailPayload) {
  const details = detailPayload?.items || {};
  return baseProducts.map((product) => {
    const detail = details[product.id];
    if (!detail) return product;
    return {
      ...product,
      officialName: product.officialName || detail.officialName || "",
      manufacturer: product.manufacturer || detail.manufacturer || "",
      description: product.description || detail.description || "",
      imageUrl: product.imageUrl || detail.imageUrl || "",
      sourceUrl: product.sourceUrl || detail.sourceUrl || "",
      sourceName: detail.sourceName || "",
      itemSeq: detail.itemSeq || "",
      matchedScore: detail.matchedScore || 0,
      matchedAt: detail.matchedAt || "",
    };
  });
}

function fromDbProduct(row) {
  return {
    id: row.id,
    name: row.name || "",
    officialName: row.official_name || "",
    category: row.category || "",
    price: row.price || "",
    stock: normalizeStoreStock(row.stock || ""),
    warehouseStock: normalizeWarehouseStock(row.warehouse_stock || ""),
    manufacturer: row.manufacturer || "",
    location: row.location || "",
    description: row.description || "",
    imageUrl: row.image_url || "",
    sourceUrl: row.source_url || "",
    sourceName: row.source_name || "",
    itemSeq: row.item_seq || "",
    matchedScore: row.matched_score || 0,
    matchedAt: row.matched_at || "",
    updatedAt: row.updated_at || "",
    updatedBy: row.updated_by || "",
  };
}

function toDbProduct(product) {
  return {
    id: product.id,
    name: product.name || "",
    official_name: product.officialName || "",
    category: product.category || "",
    price: product.price || "",
    stock: product.stock || "",
    warehouse_stock: product.warehouseStock || WAREHOUSE_STOCK_OFF,
    manufacturer: product.manufacturer || "",
    location: product.location || "",
    description: product.description || "",
    image_url: product.imageUrl || "",
    source_url: product.sourceUrl || "",
    source_name: product.sourceName || "",
    item_seq: product.itemSeq || "",
    matched_score: product.matchedScore || null,
    matched_at: product.matchedAt || null,
  };
}

async function loadProductsFromSupabase({ preserveSelection = false, quiet = false } = {}) {
  if (!quiet) els.syncStatus.textContent = "약품 데이터 불러오는 중";
  const rows = await supabaseFetch("/rest/v1/products?select=*&order=name.asc");
  const previousSelected = state.selectedId;
  state.products = rows.map(fromDbProduct);
  state.lastLoadedAt = new Date();

  if (preserveSelection && previousSelected && state.products.some((product) => product.id === previousSelected)) {
    state.selectedId = previousSelected;
  } else if (!preserveSelection) {
    state.selectedId = null;
  }

  els.seedBtn.classList.toggle("hidden", state.products.length > 0);
  renderCategoryOptions();
  renderCategoryTabs();
  renderDetail();
  els.syncStatus.textContent = `동기화됨 ${state.lastLoadedAt.toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}

async function saveProductToSupabase(product) {
  const [row] = await supabaseFetch("/rest/v1/products?on_conflict=id&select=*", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=representation",
    },
    body: JSON.stringify(toDbProduct(product)),
  });

  return fromDbProduct(row);
}

async function seedProductsToSupabase() {
  els.syncStatus.textContent = "초기 데이터 등록 중";
  const response = await fetch(SEED_URL);
  const seedProducts = await response.json();
  const chunkSize = 50;

  for (let index = 0; index < seedProducts.length; index += chunkSize) {
    const chunk = seedProducts.slice(index, index + chunkSize);
    await supabaseFetch("/rest/v1/products?on_conflict=id", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates",
      },
      body: JSON.stringify(chunk),
    });
    els.syncStatus.textContent = `초기 데이터 등록 중 ${Math.min(index + chunkSize, seedProducts.length)}/${seedProducts.length}`;
  }

  await loadProductsFromSupabase();
}

async function loadOfficialDetails() {
  try {
    const response = await fetch(DETAILS_URL);
    if (!response.ok) return {};
    return response.json();
  } catch {
    return {};
  }
}

function locationOptions() {
  const shelfOptions = [];
  for (let shelf = 1; shelf <= 15; shelf += 1) {
    shelfOptions.push(`${shelf}-L`, `${shelf}-R`);
  }
  return ["", "PS", "DR", ...shelfOptions];
}

function renderLocationOptions() {
  fields.location.innerHTML = locationOptions()
    .map((location) => {
      const label = location || "미지정";
      return `<option value="${location}">${label}</option>`;
    })
    .join("");
}

function categoryOptions() {
  const options = [];
  const seen = new Set();
  for (const item of SHELF_CATEGORIES) {
    if (seen.has(item.value)) continue;
    seen.add(item.value);
    options.push(item.value);
  }
  for (const product of state.products) {
    const category = product.category || "";
    if (!category || seen.has(category)) continue;
    seen.add(category);
    options.push(category);
  }
  return options;
}

function renderCategoryOptions() {
  fields.category.innerHTML = [
    '<option value="">미분류</option>',
    ...categoryOptions().map((category) => {
      const location = CATEGORY_LOCATION.get(category);
      const label = location ? `${category} · ${location}` : category;
      return `<option value="${escapeHtml(category)}">${escapeHtml(label)}</option>`;
    }),
  ].join("");
}

function renderCategoryTabs() {
  const counts = new Map();
  for (const product of state.products) {
    const category = product.category || "미분류";
    counts.set(category, (counts.get(category) || 0) + 1);
  }

  const categories = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  const tabs = [["", state.products.length], ...categories];

  els.categoryTabs.innerHTML = tabs
    .map(([category, count]) => {
      const label = category ? categoryLabel(category) : "전체";
      const active = state.categoryFilter === category ? " active" : "";
      const color = category ? categoryColor(category) : "#34d399";
      return `<button class="${active}" style="--cat:${color}" type="button" data-category="${category}">
        <span>${label}</span>
        <span class="category-count">${count}</span>
      </button>`;
    })
    .join("");
}

function productMatches(product) {
  const query = normalizeForSearch(els.searchInput.value);
  const location = els.locationFilter.value;
  const stock = els.stockFilter.value;
  const shelf = state.shelfFilter;
  const category = state.categoryFilter;
  const searchHaystack = normalizeForSearch(
    [
      product.name,
      product.officialName,
      product.category,
      product.manufacturer,
      product.description,
      product.location,
      product.stock,
      product.warehouseStock,
    ].join(" "),
  );

  if (query && !searchHaystack.includes(query)) return false;
  if (category && product.category !== category) return false;
  if (location && product.location !== location) return false;
  if (stock && product.stock !== stock) return false;
  if (shelf === "PS" || shelf === "DR") return product.location === shelf;
  if (shelf && !product.location.startsWith(`${shelf}-`)) return false;

  return true;
}

function formatMeta(product) {
  const parts = [
    ["official", product.officialName && product.officialName !== product.name ? product.officialName : ""],
    ["category", product.category],
    ["maker", product.manufacturer],
    ["stock", product.stock ? `재고 ${product.stock}` : ""],
    ["warehouse", product.warehouseStock || WAREHOUSE_STOCK_OFF],
    ["price", product.price ? `${Number(product.price).toLocaleString("ko-KR")}원` : ""],
  ].filter(Boolean);

  return parts
    .filter(([, value]) => value)
    .map(([type, value]) => `<span class="meta-chip ${type}">${escapeHtml(value)}</span>`)
    .join("");
}

function descriptionPreview(product, limit = 4) {
  const sections = parseDescriptionSections(product.description);
  if (!sections.length) return '<p class="description-empty">아직 상세설명이 없습니다.</p>';

  return sections
    .slice(0, limit)
    .map(
      (section) => `<section class="description-section">
        <h4>${escapeHtml(section.title)}</h4>
        <p>${escapeHtml(section.body)}</p>
      </section>`,
    )
    .join("");
}

function parseDescriptionSections(description) {
  const text = String(description || "").trim();
  if (!text) return [];

  const titles = ["효능", "사용법", "주의사항", "복용 전 확인", "상호작용", "부작용", "보관법"];
  const lines = text.split(/\n+/).map((line) => line.trim()).filter(Boolean);
  const sections = [];
  let current = null;

  for (const line of lines) {
    if (titles.includes(line)) {
      if (current) sections.push(current);
      current = { title: line, body: "" };
    } else if (current) {
      current.body = current.body ? `${current.body}\n${line}` : line;
    } else {
      current = { title: "상세설명", body: line };
    }
  }

  if (current) sections.push(current);
  return sections
    .map((section) => ({
      title: section.title,
      body: section.body.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim(),
    }))
    .filter((section) => section.body);
}

function officialBadge(product) {
  if (!product.sourceName && !product.matchedScore) {
    return '<span class="official-badge manual">직접 입력</span>';
  }

  const score = Number(product.matchedScore || 0);
  const label = score && score < 0.6 ? "공식 데이터 · 검수 필요" : "공식 데이터";
  const className = score && score < 0.6 ? "needs-review" : "verified";
  return `<span class="official-badge ${className}">${label}</span>`;
}

function applyOfficialBadge(element, product) {
  const score = Number(product.matchedScore || 0);
  let label = "직접 입력";
  let status = "manual";

  if (product.sourceName || score) {
    label = score && score < 0.6 ? "공식 데이터 · 검수 필요" : "공식 데이터";
    status = score && score < 0.6 ? "needs-review" : "verified";
  }

  element.textContent = label;
  element.className = `official-badge ${status}`;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => {
    const entities = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
    return entities[char];
  });
}

function renderResults() {
  const filtered = state.products.filter(productMatches);
  els.results.innerHTML = "";

  if (!filtered.length) {
    els.results.innerHTML = '<p class="empty">검색 결과가 없습니다.</p>';
  }

  for (const product of filtered) {
    const node = els.template.content.firstElementChild.cloneNode(true);
    node.dataset.id = product.id;
    node.style.setProperty("--cat", categoryColor(product.category || "미분류"));
    node.classList.toggle("active", product.id === state.selectedId);
    node.classList.toggle("stock-off", !stockIsOn(product.stock));
    node.querySelector(".result-name").textContent = product.name;
    node.querySelector(".result-meta").innerHTML = formatMeta(product);
    node.querySelector(".location-badge").textContent = product.location || "미지정";
    const storeToggle = node.querySelector('.stock-toggle[data-stock-type="store"]');
    const warehouseToggle = node.querySelector('.stock-toggle[data-stock-type="warehouse"]');
    storeToggle.textContent = STORE_STOCK_ON;
    warehouseToggle.textContent = WAREHOUSE_STOCK_ON;
    storeToggle.classList.toggle("is-on", stockIsOn(product.stock));
    warehouseToggle.classList.toggle("is-on", stockIsOn(product.warehouseStock, "warehouse"));
    node.querySelector(".result-description").innerHTML = descriptionPreview(product);
    node.querySelector(".official-badge").outerHTML = officialBadge(product);
    const thumb = node.querySelector(".result-thumb");
    thumb.alt = product.name;
    thumb.src = product.imageUrl || "";
    node.classList.toggle("has-image", Boolean(product.imageUrl));
    els.results.appendChild(node);
  }

  const positioned = state.products.filter((product) => product.location).length;
  els.summary.textContent = `${state.products.length}개 약품 · 위치 지정 ${positioned}개 · 검색 결과 ${filtered.length}개`;
}

function selectedProduct() {
  return state.products.find((product) => product.id === state.selectedId) || null;
}

async function addNewProduct() {
  const product = {
    id: `drug-custom-${Date.now()}`,
    name: "새 약품",
    officialName: "",
    category: "",
    price: "",
    stock: STORE_STOCK_ON,
    warehouseStock: WAREHOUSE_STOCK_OFF,
    manufacturer: "",
    location: "",
    description: "",
    imageUrl: "",
    sourceUrl: "",
    sourceName: "",
    itemSeq: "",
    matchedScore: 0,
    matchedAt: "",
    updatedAt: new Date().toISOString(),
  };
  els.syncStatus.textContent = "새 약품 생성 중";
  const saved = await saveProductToSupabase(product);
  state.products.unshift(saved);
  state.selectedId = saved.id;
  state.detailTab = "edit";
  renderCategoryTabs();
  renderDetail();
  fields.name.focus();
  fields.name.select();
  els.syncStatus.textContent = "새 약품 생성 완료";
}

function setDetailTab(tab) {
  state.detailTab = tab;
  els.descriptionView.classList.add("hidden");
  els.form.classList.toggle("hidden", !(state.selectedId && tab === "edit"));
}

function displayValue(value, fallback = "미입력") {
  return value && String(value).trim() ? value : fallback;
}

function renderDetail() {
  const product = selectedProduct();
  if (!product) {
    els.detailTitle.textContent = "약품을 선택하세요";
    els.detailCategory.textContent = "대기";
    els.detailCategory.style.setProperty("--cat", "#93c5fd");
    els.factLocation.textContent = "미지정";
    els.factStock.textContent = "미확인";
    els.factOfficialName.textContent = "미입력";
    els.factManufacturer.textContent = "미입력";
    els.factPrice.textContent = "미입력";
    els.factDescription.innerHTML = '<p class="description-empty">약품을 선택하면 상세설명이 표시됩니다.</p>';
    els.factSource.textContent = "미입력";
    els.matchNotice.textContent = "";
    els.matchNotice.classList.remove("visible");
    els.drugImage.alt = "";
    els.drugImage.src = "";
    els.imageBox.classList.remove("has-image");
    applyOfficialBadge(els.factOfficialBadge, {});
    setDetailTab("view");
    renderResults();
    return;
  }

  state.selectedId = product.id;
  const category = product.category || "미분류";

  els.detailTitle.textContent = product.name;
  els.detailCategory.textContent = categoryLabel(category);
  els.detailCategory.style.setProperty("--cat", categoryColor(category));
  els.factLocation.textContent = product.location || "미지정";
  els.factStock.textContent = product.stock || "미확인";
  els.factOfficialName.textContent = displayValue(product.officialName);
  els.factManufacturer.textContent = displayValue(product.manufacturer);
  els.factPrice.textContent = product.price ? `${Number(product.price).toLocaleString("ko-KR")}원` : "미입력";
  els.factDescription.innerHTML = descriptionPreview(product, Infinity);
  applyOfficialBadge(els.factOfficialBadge, product);
  const score = Number(product.matchedScore || 0);
  if (score && score < 0.6) {
    els.matchNotice.textContent = `자동 매칭 신뢰도 ${(score * 100).toFixed(0)}%: 공식 데이터와 제품명이 완전히 같지 않아 검수가 필요합니다.`;
    els.matchNotice.classList.add("visible");
  } else if (score) {
    els.matchNotice.textContent = `식약처 e약은요 자동 매칭 완료 · 신뢰도 ${(score * 100).toFixed(0)}%`;
    els.matchNotice.classList.add("visible");
  } else {
    els.matchNotice.textContent = "";
    els.matchNotice.classList.remove("visible");
  }
  els.factSource.innerHTML = product.sourceUrl
    ? `<a href="${escapeHtml(product.sourceUrl)}" target="_blank" rel="noreferrer">${escapeHtml(product.sourceName || "공식 출처 열기")}</a>`
    : "미입력";

  fields.name.value = product.name;
  fields.officialName.value = product.officialName || "";
  fields.location.value = product.location || "";
  fields.stock.value = product.stock || "";
  fields.warehouseStock.value = product.warehouseStock || "";
  fields.category.value = product.category || "";
  fields.price.value = product.price || "";
  fields.manufacturer.value = product.manufacturer || "";
  fields.imageUrl.value = product.imageUrl || "";
  fields.imageFile.value = "";
  fields.sourceUrl.value = product.sourceUrl || "";
  fields.description.value = product.description || "";

  els.drugImage.alt = product.name;
  els.drugImage.src = product.imageUrl || "";
  els.imageBox.classList.toggle("has-image", Boolean(product.imageUrl));
  setDetailTab(state.detailTab);
  renderResults();
}

async function updateSelectedProduct() {
  const product = selectedProduct();
  if (!product) return;

  Object.assign(product, {
    name: fields.name.value.trim(),
    officialName: fields.officialName.value.trim(),
    location: fields.location.value,
    stock: fields.stock.value,
    warehouseStock: fields.warehouseStock.value,
    category: fields.category.value.trim(),
    price: fields.price.value.trim(),
    manufacturer: fields.manufacturer.value.trim(),
    imageUrl: fields.imageUrl.value.trim(),
    sourceUrl: fields.sourceUrl.value.trim(),
    description: fields.description.value.trim(),
    updatedAt: new Date().toISOString(),
  });

  if (product.category.includes("파스")) product.location = "PS";
  if (product.category.includes("드링크")) product.location = "DR";
  if (!product.location && CATEGORY_LOCATION.has(product.category)) product.location = CATEGORY_LOCATION.get(product.category);

  els.syncStatus.textContent = "저장 중";
  const saved = await saveProductToSupabase(product);
  const index = state.products.findIndex((item) => item.id === saved.id);
  if (index >= 0) state.products[index] = saved;
  renderCategoryTabs();
  renderDetail();
  els.syncStatus.textContent = "저장 완료";
}

async function toggleStock(product, type) {
  if (type === "warehouse") {
    product.warehouseStock = stockIsOn(product.warehouseStock, "warehouse") ? WAREHOUSE_STOCK_OFF : WAREHOUSE_STOCK_ON;
  } else {
    product.stock = stockIsOn(product.stock) ? STORE_STOCK_OFF : STORE_STOCK_ON;
  }

  els.syncStatus.textContent = "재고 저장 중";
  const saved = await saveProductToSupabase(product);
  const index = state.products.findIndex((item) => item.id === saved.id);
  if (index >= 0) state.products[index] = saved;
  renderResults();
  if (state.selectedId === saved.id) renderDetail();
  els.syncStatus.textContent = "재고 저장 완료";
}

function exportJson() {
  const blob = new Blob([JSON.stringify(state.products, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `pharmacy-products-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

async function importJson(file) {
  const text = await file.text();
  const imported = JSON.parse(text);
  if (!Array.isArray(imported)) throw new Error("JSON 배열 형식이 아닙니다.");
  const dbRows = imported.map((product) => toDbProduct(product));
  await supabaseFetch("/rest/v1/products?on_conflict=id", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates",
    },
    body: JSON.stringify(dbRows),
  });
  await loadProductsFromSupabase();
}

async function init() {
  renderLocationOptions();
  renderCategoryOptions();
  showApp();
  await loadProductsFromSupabase();
  startSync();
}

els.searchInput.addEventListener("input", renderResults);
els.locationFilter.addEventListener("change", renderResults);
els.stockFilter.addEventListener("change", renderResults);
els.addProductBtn.addEventListener("click", () => {
  addNewProduct().catch((error) => {
    console.error(error);
    els.syncStatus.textContent = "약품 추가 실패";
    alert(`약품 추가에 실패했습니다: ${error.message}`);
  });
});
els.categoryTabs.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-category]");
  if (!button) return;
  state.categoryFilter = button.dataset.category;
  renderCategoryTabs();
  renderResults();
});
els.results.addEventListener("click", (event) => {
  const editButton = event.target.closest(".edit-product-btn");
  if (editButton) {
    const card = event.target.closest(".result-card");
    if (!card) return;
    state.selectedId = card.dataset.id;
    state.detailTab = "edit";
    renderDetail();
    return;
  }

  const stockButton = event.target.closest(".stock-toggle");
  if (stockButton) {
    const card = event.target.closest(".result-card");
    const product = state.products.find((item) => item.id === card?.dataset.id);
    if (!product) return;
    toggleStock(product, stockButton.dataset.stockType).catch((error) => {
      console.error(error);
      els.syncStatus.textContent = "재고 저장 실패";
      alert(`재고 저장에 실패했습니다: ${error.message}`);
    });
    return;
  }

  const card = event.target.closest(".result-card");
  if (!card) return;
  if (!event.target.closest(".result-head")) return;
  state.selectedId = state.selectedId === card.dataset.id ? null : card.dataset.id;
  state.detailTab = "view";
  renderDetail();
});
els.form.addEventListener("submit", (event) => {
  event.preventDefault();
  updateSelectedProduct().catch((error) => {
    console.error(error);
    els.syncStatus.textContent = "저장 실패";
    alert(`저장에 실패했습니다: ${error.message}`);
  });
});
$("#resetBtn").addEventListener("click", async () => {
  const product = selectedProduct();
  if (!product) return;
  product.location = initialLocation(product.category);
  product.stock = STORE_STOCK_ON;
  product.warehouseStock = WAREHOUSE_STOCK_OFF;
  product.officialName = "";
  product.description = "";
  product.imageUrl = "";
  product.sourceUrl = "";
  product.updatedAt = new Date().toISOString();
  try {
    const saved = await saveProductToSupabase(product);
    const index = state.products.findIndex((item) => item.id === saved.id);
    if (index >= 0) state.products[index] = saved;
    renderDetail();
  } catch (error) {
    console.error(error);
    alert(`초기화에 실패했습니다: ${error.message}`);
  }
});
els.exportBtn.addEventListener("click", exportJson);
els.importInput.addEventListener("change", async (event) => {
  const [file] = event.target.files;
  if (!file) return;
  try {
    await importJson(file);
  } catch (error) {
    alert(`가져오기에 실패했습니다: ${error.message}`);
  } finally {
    event.target.value = "";
  }
});
fields.imageUrl.addEventListener("change", () => {
  els.drugImage.src = fields.imageUrl.value.trim();
  els.imageBox.classList.toggle("has-image", Boolean(fields.imageUrl.value.trim()));
});
fields.category.addEventListener("change", () => {
  const category = fields.category.value;
  if (CATEGORY_LOCATION.has(category)) fields.location.value = CATEGORY_LOCATION.get(category);
});
fields.imageFile.addEventListener("change", async (event) => {
  const [file] = event.target.files;
  const product = selectedProduct();
  if (!file || !product) return;

  if (!file.type.startsWith("image/")) {
    alert("이미지 파일만 업로드할 수 있습니다.");
    event.target.value = "";
    return;
  }

  try {
    els.syncStatus.textContent = "이미지 업로드 중";
    const imageBlob = await imageFileToBlob(file);
    const path = `${product.id}-${Date.now()}.jpg`;
    const imageUrl = await uploadImageToSupabase(path, imageBlob);
    product.imageUrl = imageUrl;
    product.updatedAt = new Date().toISOString();
    fields.imageUrl.value = imageUrl;
    const saved = await saveProductToSupabase(product);
    const index = state.products.findIndex((item) => item.id === saved.id);
    if (index >= 0) state.products[index] = saved;
    renderDetail();
    els.syncStatus.textContent = "이미지 저장 완료";
  } catch (error) {
    console.error(error);
    els.syncStatus.textContent = "이미지 업로드 실패";
    alert(`이미지 업로드에 실패했습니다: ${error.message}`);
  }
});

async function imageFileToBlob(file) {
  if ("createImageBitmap" in window) {
    const bitmap = await createImageBitmap(file);
    const maxSize = 900;
    const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d");
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close?.();
    return new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.84));
  }

  return file;
}

async function uploadImageToSupabase(path, blob) {
  await supabaseFetch(`/storage/v1/object/drug-images/${encodeURIComponent(path)}`, {
    method: "POST",
    headers: {
      "Content-Type": "image/jpeg",
      "x-upsert": "true",
    },
    body: blob,
  });
  return `${SUPABASE_URL}/storage/v1/object/public/drug-images/${encodeURIComponent(path)}`;
}

els.seedBtn.addEventListener("click", () => {
  seedProductsToSupabase().catch((error) => {
    console.error(error);
    els.syncStatus.textContent = "초기 데이터 등록 실패";
    alert(`초기 데이터 등록에 실패했습니다: ${error.message}`);
  });
});

init().catch((error) => {
  console.error(error);
  els.summary.textContent = "데이터를 불러오지 못했습니다.";
});
