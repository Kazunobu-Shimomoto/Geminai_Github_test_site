document.addEventListener('DOMContentLoaded', () => {
    let languageData = {};
    let currentLang = localStorage.getItem('lang') || 'en'; // デフォルトは英語

    const langSwitchers = document.querySelectorAll('.lang-switcher button');

    async function fetchLanguageData(lang) {
        const response = await fetch(`locales/${lang}.json`);
        return response.json();
    }

    function updateContent(langData) {
        document.querySelectorAll('[data-i18n-key]').forEach(element => {
            const key = element.getAttribute('data-i18n-key');
            if (langData[key]) {
                //innerHTMLを使うことで<br>などのタグも反映させる
                element.innerHTML = langData[key];
            }
        });
        // HTMLのlang属性も更新
        document.documentElement.lang = currentLang;
        
        // 元のJavaScriptにあった動的テキストの更新もここで行う
        updateHSPResult(); 
        checkNomadEligibility();
    }
    
    async function switchLanguage(lang) {
        if (!['en', 'ja'].includes(lang)) return;

        currentLang = lang;
        languageData = await fetchLanguageData(lang);
        localStorage.setItem('lang', lang);
        
        updateContent(languageData);

        // スイッチボタンのアクティブ状態を更新
        langSwitchers.forEach(button => {
            button.classList.remove('active');
            if (button.id.includes(`lang-${lang}`)) {
                button.classList.add('active');
            }
        });
    }

    // --- 元のJavaScriptから持ってきた動的更新ロジック ---
    // グローバルスコープに `languageData` を公開して、他のスクリプトからアクセス可能にする
    window.getLangString = (key, replacements = {}) => {
        let text = languageData[key] || key;
        for (const placeholder in replacements) {
            text = text.replace(`{${placeholder}}`, replacements[placeholder]);
        }
        return text;
    };

    function updateHSPResult() {
        // HSPポイント計算ロジック (元のファイルから引用)
        const calculateHSPPoints = () => {
            // ... (元の `calculateHSPPoints` 関数のロジックをここにペースト) ...
             let totalPoints = 0;
            const activityType = document.getElementById('activity_type').value;
            const education = document.getElementById('education').value;
            const experience = document.getElementById('experience').value;
            let income = parseInt(document.getElementById('income').value, 10);
            const age = document.getElementById('age').value;

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
                totalPoints = 0;
            }

            document.querySelectorAll('#hsp-form input[type="checkbox"]:checked').forEach(cb => {
                totalPoints += parseInt(cb.value, 10);
            });

            return totalPoints;
        };
        
        const points = calculateHSPPoints();
        const resultTextDiv = document.getElementById('hsp-result-text');
        let messageKey = '';
        let bgColor = 'bg-gray-100';

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
        
        resultTextDiv.innerHTML = `<p>${getLangString(messageKey, { points: points })}</p>`;
        resultTextDiv.className = `mt-6 p-4 rounded-lg min-h-[120px] flex items-center justify-center text-center ${bgColor}`;
        
        // ... (Chart.jsのロジックは変更なし) ...
    }

    function checkNomadEligibility() {
        const nomadForm = document.getElementById('nomad-form');
        const nomadResultTextDiv = document.getElementById('nomad-result-text');
        if (!nomadForm || !nomadResultTextDiv) return;

        const q1 = nomadForm.q1.value === 'yes';
        const q2 = nomadForm.q2.value === 'yes';
        const q3 = nomadForm.q3.value === 'yes';
        const q4 = nomadForm.q4.value === 'yes';
        const isEligible = q1 && q2 && q3 && q4;
        
        let messageKey = '';
        let bgColor = 'bg-gray-100';

        if (isEligible) {
            messageKey = 'nomad_result_message_eligible';
            bgColor = 'bg-green-100';
            nomadResultTextDiv.innerHTML = `<p>${getLangString(messageKey)}</p>`;
        } else {
            messageKey = 'nomad_result_message_ineligible';
            bgColor = 'bg-yellow-100';
            let reasons = [];
            if (!q1) reasons.push(getLangString('nomad_q1_title'));
            if (!q2) reasons.push(getLangString('nomad_q2_title'));
            if (!q3) reasons.push(getLangString('nomad_q3_title'));
            if (!q4) reasons.push(getLangString('nomad_q4_title'));
            nomadResultTextDiv.innerHTML = `<p>${getLangString(messageKey, { reasons: reasons.join(', ') })}</p>`;
        }
        nomadResultTextDiv.className = `mt-8 p-6 rounded-lg text-center min-h-[120px] flex items-center justify-center ${bgColor}`;
    }

    // イベントリスナーの設定
    langSwitchers.forEach(button => {
        button.addEventListener('click', (e) => {
            switchLanguage(e.target.id.includes('lang-ja') ? 'ja' : 'en');
        });
    });

    document.getElementById('hsp-form')?.addEventListener('input', updateHSPResult);
    document.getElementById('nomad-form')?.addEventListener('change', checkNomadEligibility);


    // 初期化
    switchLanguage(currentLang);
});