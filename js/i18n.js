document.addEventListener('DOMContentLoaded', () => {
    // --- 設定 ---
    const CONFIG = {
        defaultLang: 'en',
        sheetBase: 'https://opensheet.elk.sh/12WnMhGP1YYyUEFfQMhkoSNpuzbxz6tCxf5EfAOhOK5k',
        blogSheet: 'https://opensheet.elk.sh/1uNQQbNxd6-48OwUwSCry3yqMk2F8giuMQm5XVe5QRrM/Form Responses 1'
    };

    // --- 状態管理 ---
    let languageData = {};
    let hspChart = null;
    let currentLang = localStorage.getItem('lang') || CONFIG.defaultLang;

    // --- DOM要素セレクター ---
    const DOMElements = {
        langSwitchers: document.querySelectorAll('.lang-switcher button'),
        mobileMenuButton: document.getElementById('mobile-menu-button'),
        mobileMenu: document.getElementById('mobile-menu'),
        hspTab: document.getElementById('hsp-tab-button'),
        nomadTab: document.getElementById('nomad-tab-button'),
        hspChecker: document.getElementById('hsp-checker'),
        nomadChecker: document.getElementById('nomad-checker'),
        hspForm: document.getElementById('hsp-form'),
        nomadForm: document.getElementById('nomad-form'),
        hspResultText: document.getElementById('hsp-result-text'),
        nomadResultText: document.getElementById('nomad-result-text'),
        comparisonTable: document.querySelector('#visa-comparison-table tbody'),
        needsForm: document.getElementById('needs-assessment-form'),
        actionPlan: document.getElementById('action-plan'),
        actionPlanContent: document.getElementById('action-plan-content'),
        blogContainer: document.getElementById('blog-container')
    };

    // --- 言語とUI ---
    async function fetchLanguageData(lang) {
        try {
            const response = await fetch(`locales/${lang}.json`);
            if (!response.ok) throw new Error(`Failed to load ${lang}.json`);
            return await response.json();
        } catch (error) {
            console.error('Language fetch error:', error);
            return {}; // 失敗した場合は空のオブジェクトを返す
        }
    }

    function getLangString(key, replacements = {}) {
        let text = key.split('.').reduce((obj, k) => obj && obj[k], languageData) || key;
        Object.entries(replacements).forEach(([placeholder, value]) => {
            text = text.replace(`{${placeholder}}`, value);
        });
        return text;
    }

    function updateUI() {
        document.querySelectorAll('[data-i18n-key]').forEach(el => {
            el.innerHTML = getLangString(el.dataset.i18nKey);
        });
        document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
            el.placeholder = getLangString(el.dataset.i18nPlaceholder);
        });
        document.documentElement.lang = currentLang;
        
        // title要素が存在する場合のみ更新
        const titleElement = document.querySelector('title[data-i18n-key]');
        if (titleElement) {
            document.title = getLangString(titleElement.dataset.i18nKey);
        }

        // 動的部分の更新
        if (DOMElements.hspForm) updateHSPResult();
        if (DOMElements.nomadForm) checkNomadEligibility();
        if (DOMElements.comparisonTable) renderComparisonTable();
        if (DOMElements.blogContainer) loadBlog();
        
        const actionPlanDiv = document.getElementById('action-plan');
        if (actionPlanDiv && !actionPlanDiv.classList.contains('hidden')) {
            renderActionPlan();
        }
    }

    async function switchLanguage(lang) {
        currentLang = (lang === 'ja' || lang === 'en') ? lang : CONFIG.defaultLang;
        languageData = await fetchLanguageData(currentLang);
        localStorage.setItem('lang', currentLang);

        DOMElements.langSwitchers.forEach(button => {
            button.classList.toggle('active', button.id.includes(`lang-${currentLang}`));
        });

        updateUI();
    }

    // --- 動的コンテンツのレンダラー ---
    function calculateHSPPoints() {
        if (!DOMElements.hspForm) return 0;
        const form = DOMElements.hspForm;
        let totalPoints = 0;
        
        const values = {
            activity: form.activity_type.value,
            education: parseInt(form.education.value, 10),
            experience: parseInt(form.experience.value, 10),
            income: parseInt(form.income.value, 10),
            age: parseInt(form.age.value, 10)
        };

        const hspData = {
            education: { 0:0, 10:10, 20:20, 30:30 },
            experience: { 0:0, 5:5, 10:10, 15:15, 20:20 },
            incomeRanges: [ { t:1000, p:40 }, { t:900, p:35 }, { t:800, p:30 }, { t:700, p:25 }, { t:600, p:20 }, { t:500, p:15 }, { t:400, p:10 }, { t:300, p:0 } ],
            age: { 15:15, 10:10, 5:5, 0:0 }
        };

        totalPoints += values.education + values.experience + values.age;

        if (!isNaN(values.income)) {
            if (values.activity !== 'management' && values.income < 300) {
                 // 300万円未満はポイントなし（経営管理以外）
            } else {
                totalPoints += (hspData.incomeRanges.find(r => values.income >= r.t) || {p:0}).p;
            }
        }

        if (values.activity === 'management' && (isNaN(values.income) || values.income < 1000)) return 0;

        form.querySelectorAll('input[type=\"checkbox\"]:checked').forEach(cb => {
            totalPoints += parseInt(cb.value, 10);
        });

        return totalPoints;
    }

    function updateHSPResult() {
        if (!DOMElements.hspResultText) return;
        const points = calculateHSPPoints();
        
        let messageKey, bgColor;
        if (points >= 80) { [messageKey, bgColor] = ['hsp_result_message_high', 'bg-green-100']; }
        else if (points >= 70) { [messageKey, bgColor] = ['hsp_result_message_medium', 'bg-blue-100']; }
        else { [messageKey, bgColor] = ['hsp_result_message_low', 'bg-yellow-100']; }

        DOMElements.hspResultText.innerHTML = `<p>${getLangString(messageKey, { points })}</p>`;
        DOMElements.hspResultText.className = `mt-6 p-4 rounded-lg min-h-[120px] flex items-center justify-center text-center ${bgColor}`;

        if (hspChart) {
            hspChart.data.datasets[0].data = [points, Math.max(0, 100 - points)];
            hspChart.update();
        } else {
            const ctx = document.getElementById('hsp-chart')?.getContext('2d');
            if (!ctx) return;
            hspChart = new Chart(ctx, {
                type: 'doughnut',
                data: { datasets: [{ data: [points, 100 - points], backgroundColor: ['#008080', '#E0E0E0'], borderWidth: 0 }] },
                options: { responsive: true, maintainAspectRatio: false, cutout: '70%', plugins: { legend: { display: false }, tooltip: { enabled: false } } }
            });
        }
    }

    function checkNomadEligibility() {
        if (!DOMElements.nomadResultText) return;
        const form = DOMElements.nomadForm;
        const isEligible = ['q1', 'q2', 'q3', 'q4'].every(q => form[q].value === 'yes');
        let messageKey, bgColor, reasons = [];

        if (isEligible) {
            [messageKey, bgColor] = ['nomad_result_message_eligible', 'bg-green-100'];
        } else {
            [messageKey, bgColor] = ['nomad_result_message_ineligible', 'bg-yellow-100'];
            if (form.q1.value === 'no') reasons.push(getLangString('nomad_q1_reason'));
            if (form.q2.value === 'no') reasons.push(getLangString('nomad_q2_reason'));
            if (form.q3.value === 'no') reasons.push(getLangString('nomad_q3_reason'));
            if (form.q4.value === 'no') reasons.push(getLangString('nomad_q4_reason'));
        }

        DOMElements.nomadResultText.innerHTML = `<p>${getLangString(messageKey, { reasons: reasons.join(', ') })}</p>`;
        DOMElements.nomadResultText.className = `mt-8 p-6 rounded-lg text-center min-h-[120px] flex items-center justify-center ${bgColor}`;
    }

    async function renderComparisonTable() {
        if (!DOMElements.comparisonTable) return;
        // 重要：Google Sheets側に visa_comparison_ja と visa_comparison_en のシートが必要です
        const response = await fetch(`${CONFIG.sheetBase}/visa_comparison_${currentLang}`);
        const data = await response.json();
        DOMElements.comparisonTable.innerHTML = data.map(row => `
            <tr class="border-b hover:bg-gray-50">
                <td class="p-4 font-semibold align-top relative group tooltip-trigger">
                    ${row.item}
                    <span class="tooltip">${row.hint}</span>
                </td>
                <td class="p-4 align-top">${row.hsp}</td>
                <td class="p-4 align-top">${row.nomad}</td>
            </tr>`).join('');
    }

    async function renderActionPlan() {
        if (!DOMElements.actionPlan) return;
        const selected = Array.from(DOMElements.needsForm.querySelectorAll('input:checked')).map(cb => cb.value);
        if (selected.length === 0) {
            DOMElements.actionPlan.classList.add('hidden');
            return;
        }

        // 重要：Google Sheets側に ..._ja と ..._en のシートが必要です
        const [items, vendors] = await Promise.all([
            fetch(`${CONFIG.sheetBase}/support_items_${currentLang}`).then(res => res.json()),
            fetch(`${CONFIG.sheetBase}/support_vendors_${currentLang}`).then(res => res.json())
        ]);

        DOMElements.actionPlanContent.innerHTML = items
            .filter(i => selected.includes(i.id))
            .map(item => {
                const relatedVendors = vendors.filter(v => v.support_id === item.id);
                return `
                <div class="bg-white p-6 rounded-lg shadow-md border-l-4 border-accent">
                    <h4 class="font-bold text-xl mb-2">${item.title}</h4>
                    <p class="text-gray-700">${item.solution}</p>
                    ${relatedVendors.length > 0 ? `<h5 class="font-semibold mt-4 mb-2 text-gray-800">${getLangString('action_plan_vendors_title')}</h5>
                    <ul class="space-y-3 list-disc list-inside text-sm">${relatedVendors.map(v => `<li><a href="${v.website}" target="_blank" class="text-accent hover:underline font-medium">${v.name}</a>: ${v.description}</li>`).join('')}</ul>` : ''}
                </div>`;
            }).join('');
        
        DOMElements.actionPlan.classList.remove('hidden');
    }

    async function loadBlog() {
        if (!DOMElements.blogContainer) return;
        const response = await fetch(CONFIG.blogSheet);
        const data = await response.json();
        // Google Sheetの列名を言語ごとに切り替える
        const titleField = currentLang === 'ja' ? '活動タイトル' : 'Title';
        const contentField = currentLang === 'ja' ? '内容' : 'Content';
        
        DOMElements.blogContainer.innerHTML = data.reverse().map(entry => `
            <article class="bg-white p-6 rounded-lg shadow hover:shadow-lg transition">
              <p class="text-xs text-gray-400 mb-2">${entry.Timestamp}</p>
              <h2 class="text-xl font-semibold mb-2 text-accent">${entry[titleField] || ''}</h2>
              <p class="text-gray-700 text-sm whitespace-pre-line leading-relaxed">${entry[contentField] || ''}</p>
            </article>`).join('');
    }

    // --- イベントリスナー ---
    function setupEventListeners() {
        DOMElements.langSwitchers.forEach(btn => btn.addEventListener('click', () => switchLanguage(btn.id.includes('lang-ja') ? 'ja' : 'en')));
        
        DOMElements.mobileMenuButton?.addEventListener('click', () => DOMElements.mobileMenu.classList.toggle('hidden'));
        document.querySelectorAll('.mobile-menu-link').forEach(link => link.addEventListener('click', () => DOMElements.mobileMenu.classList.add('hidden')));

        DOMElements.hspTab?.addEventListener('click', () => {
            DOMElements.hspChecker.classList.remove('hidden');
            DOMElements.nomadChecker.classList.add('hidden');
            DOMElements.hspTab.classList.add('active');
            DOMElements.nomadTab.classList.remove('active');
        });

        DOMElements.nomadTab?.addEventListener('click', () => {
            DOMElements.nomadChecker.classList.remove('hidden');
            DOMElements.hspChecker.classList.add('hidden');
            DOMElements.nomadTab.classList.add('active');
            DOMElements.hspTab.classList.remove('active');
        });

        DOMElements.hspForm?.addEventListener('input', updateHSPResult);
        DOMElements.nomadForm?.addEventListener('change', checkNomadEligibility);
        DOMElements.needsForm?.addEventListener('submit', e => {
            e.preventDefault();
            renderActionPlan().then(() => DOMElements.actionPlan.scrollIntoView({ behavior: 'smooth' }));
        });
    }

    // --- 初期化 ---
    function init() {
        setupEventListeners();
        switchLanguage(currentLang);
        DOMElements.hspTab?.classList.add('active'); // 初期の表示タブをアクティブにする
    }

    init();
});