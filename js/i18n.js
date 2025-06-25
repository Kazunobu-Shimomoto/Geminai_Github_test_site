document.addEventListener('DOMContentLoaded', () => {
    let languageData = {};
    let currentLang = localStorage.getItem('lang') || 'en'; // デフォルトは英語
    let hspChart = null;

    const langSwitchers = document.querySelectorAll('.lang-switcher button');

    // 対応するJSONファイルから言語データを取得します
    async function fetchLanguageData(lang) {
        try {
            const response = await fetch(`locales/${lang}.json`);
            if (!response.ok) {
                console.error(`Could not fetch language file: ${lang}.json`);
                return {};
            }
            return response.json();
        } catch (error) {
            console.error('Error fetching language data:', error);
            return {};
        }
    }

    // 読み込んだ言語データから文字列を取得します（変数の置換も可能）
    function getLangString(key, replacements = {}) {
        let text = languageData[key] || key;
        for (const placeholder in replacements) {
            text = text.replace(`{${placeholder}}`, replacements[placeholder]);
        }
        return text;
    }

    // data-i18n-key属性を持つすべての要素を更新します
    function updateUI() {
        document.querySelectorAll('[data-i18n-key]').forEach(element => {
            const key = element.getAttribute('data-i18n-key');
            if (languageData[key]) {
                element.innerHTML = getLangString(key);
            }
        });

        document.querySelectorAll('[data-i18n-placeholder]').forEach(element => {
            const key = element.getAttribute('data-i18n-placeholder');
            if (languageData[key]) {
                element.placeholder = getLangString(key);
            }
        });

        // アクセシビリティのためにHTMLのlang属性を更新します
        document.documentElement.lang = currentLang;

        // 言語に依存する動的コンテンツを再描画します
        updateHSPResult();
        checkNomadEligibility();
    }

    // 言語を切り替えるメインの関数です
    async function switchLanguage(lang) {
        if (!['en', 'ja'].includes(lang)) return;

        currentLang = lang;
        languageData = await fetchLanguageData(lang);
        localStorage.setItem('lang', lang);

        updateUI();

        // 言語切り替えボタンのアクティブ状態を更新します
        langSwitchers.forEach(button => {
            button.classList.remove('active');
            if (button.id.includes(`lang-${lang}`)) {
                button.classList.add('active');
            }
        });
    }

    // --- 動的ウィジェット（計算機など）のロジック ---

    function calculateHSPPoints() {
        let totalPoints = 0;
        const hspForm = document.getElementById('hsp-form');
        if (!hspForm) return 0;

        const education = hspForm.querySelector('#education').value;
        const experience = hspForm.querySelector('#experience').value;
        let income = parseInt(hspForm.querySelector('#income').value, 10);
        const age = hspForm.querySelector('#age').value;
        const activityType = hspForm.querySelector('#activity_type').value;

        const hspData = {
            education: { '0': 0, '10': 10, '20': 20, '30': 30 },
            experience: { '0': 0, '5': 5, '10': 10, '15': 15, '20': 20 },
            incomeRanges: [
                { threshold: 1000, points: 40 }, { threshold: 900, points: 35 },
                { threshold: 800, points: 30 }, { threshold: 700, points: 25 },
                { threshold: 600, points: 20 }, { threshold: 500, points: 15 },
                { threshold: 400, points: 10 }, { threshold: 300, points: 0 }
            ],
            age: { '15': 15, '10': 10, '5': 5, '0': 0 }
        };

        totalPoints += hspData.education[education] || 0;
        totalPoints += hspData.experience[experience] || 0;
        totalPoints += hspData.age[age] || 0;

        let incomePoints = 0;
        if (!isNaN(income)) {
            if (activityType !== 'management' && income < 300) {
                incomePoints = 0;
            } else {
                for (const range of hspData.incomeRanges) {
                    if (income >= range.threshold) {
                        incomePoints = range.points;
                        break;
                    }
                }
            }
        }
        totalPoints += incomePoints;
        
        if (activityType === 'management' && (isNaN(income) || income < 1000)) {
            return 0; // マネージャーの収入要件を満たしていない
        }

        hspForm.querySelectorAll('input[type="checkbox"]:checked').forEach(cb => {
            totalPoints += parseInt(cb.value, 10);
        });

        return totalPoints;
    }

    function updateHSPResult() {
        const resultTextDiv = document.getElementById('hsp-result-text');
        if (!resultTextDiv) return;

        const points = calculateHSPPoints();
        let messageKey = 'hsp_result_initial';
        let bgColor = 'bg-gray-100';

        if (document.getElementById('income').value) { // 年収が入力された場合のみメッセージを表示
            if (points >= 80) {
                messageKey = 'hsp_result_message_high';
                bgColor = 'bg-green-100';
            } else if (points >= 70) {
                messageKey = 'hsp_result_message_medium';
                bgColor = 'bg-blue-100';
            } else {
                messageKey = 'hsp_result_message_low';
                bgColor = 'bg-yellow-100';
            }
        }
        
        resultTextDiv.innerHTML = `<p>${getLangString(messageKey, { points: points })}</p>`;
        resultTextDiv.className = `mt-6 p-4 rounded-lg min-h-[120px] flex items-center justify-center text-center ${bgColor}`;
        
        const chartData = [points, Math.max(0, 100 - points)];
        if (hspChart) {
            hspChart.data.datasets[0].data = chartData;
            hspChart.update();
        } else {
            const ctx = document.getElementById('hsp-chart')?.getContext('2d');
            if(ctx){
                hspChart = new Chart(ctx, {
                    type: 'doughnut',
                    data: {
                        datasets: [{
                            data: chartData,
                            backgroundColor: ['#008080', '#E0E0E0'],
                            borderWidth: 0
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        cutout: '70%',
                        plugins: { legend: { display: false }, tooltip: { enabled: false } },
                        animation: { duration: 1000 }
                    }
                });
            }
        }
    }

    function checkNomadEligibility() {
        const nomadForm = document.getElementById('nomad-form');
        const resultTextDiv = document.getElementById('nomad-result-text');
        if (!nomadForm || !resultTextDiv) return;

        const q1 = nomadForm.q1.value === 'yes';
        const q2 = nomadForm.q2.value === 'yes';
        const q3 = nomadForm.q3.value === 'yes';
        const q4 = nomadForm.q4.value === 'yes';
        const isEligible = q1 && q2 && q3 && q4;
        
        let messageKey = 'nomad_result_initial';
        let bgColor = 'bg-gray-100';

        if (Array.from(nomadForm.querySelectorAll('input:checked')).length > 0) {
            if (isEligible) {
                messageKey = 'nomad_result_message_eligible';
                bgColor = 'bg-green-100';
            } else {
                messageKey = 'nomad_result_message_ineligible';
                bgColor = 'bg-yellow-100';
                let reasons = [];
                if (!q1) reasons.push(getLangString('nomad_q1_reason'));
                if (!q2) reasons.push(getLangString('nomad_q2_reason'));
                if (!q3) reasons.push(getLangString('nomad_q3_reason'));
                if (!q4) reasons.push(getLangString('nomad_q4_reason'));
                resultTextDiv.innerHTML = `<p>${getLangString(messageKey, { reasons: reasons.join(', ') })}</p>`;
                resultTextDiv.className = `mt-8 p-6 rounded-lg text-center min-h-[120px] flex items-center justify-center ${bgColor}`;
                return;
            }
        }
        
        resultTextDiv.innerHTML = `<p>${getLangString(messageKey)}</p>`;
        resultTextDiv.className = `mt-8 p-6 rounded-lg text-center min-h-[120px] flex items-center justify-center ${bgColor}`;
    }

    // --- イベントリスナーのセットアップ ---

    function setupEventListeners() {
        langSwitchers.forEach(button => {
            button.addEventListener('click', (e) => {
                const lang = e.target.id.includes('lang-ja') ? 'ja' : 'en';
                switchLanguage(lang);
            });
        });

        const hspTabButton = document.getElementById('hsp-tab-button');
        const nomadTabButton = document.getElementById('nomad-tab-button');
        const hspChecker = document.getElementById('hsp-checker');
        const nomadChecker = document.getElementById('nomad-checker');

        hspTabButton?.addEventListener('click', () => {
            hspTabButton.classList.add('active');
            nomadTabButton.classList.remove('active');
            hspChecker.classList.remove('hidden');
            nomadChecker.classList.add('hidden');
        });
        
        nomadTabButton?.addEventListener('click', () => {
            nomadTabButton.classList.add('active');
            hspTabButton.classList.remove('active');
            nomadChecker.classList.remove('hidden');
            hspChecker.classList.add('hidden');
        });

        document.getElementById('hsp-form')?.addEventListener('input', updateHSPResult);
        document.getElementById('nomad-form')?.addEventListener('change', checkNomadEligibility);
        
        const mobileMenuButton = document.getElementById('mobile-menu-button');
        const mobileMenu = document.getElementById('mobile-menu');
        
        mobileMenuButton?.addEventListener('click', () => {
            mobileMenu.classList.toggle('hidden');
        });
        
        document.querySelectorAll('#mobile-menu a').forEach(link => {
            link.addEventListener('click', () => {
                 mobileMenu.classList.add('hidden');
            });
        });
    }

    // --- 初期化 ---
    async function init() {
        setupEventListeners();
        await switchLanguage(currentLang); // デフォルトまたは保存された言語を読み込みます
    }

    init();
});