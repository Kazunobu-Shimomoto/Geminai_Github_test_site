
document.addEventListener('DOMContentLoaded', () => {
  const sheetBase = "https://opensheet.elk.sh/12WnMhGP1YYyUEFfQMhkoSNpuzbxz6tCxf5EfAOhOK5k";

  const hspBtn = document.getElementById('hsp-tab-button');
  const nomadBtn = document.getElementById('nomad-tab-button');
  const hspChecker = document.getElementById('hsp-checker');
  const nomadChecker = document.getElementById('nomad-checker');

  if (hspBtn && nomadBtn && hspChecker && nomadChecker) {
    hspBtn.addEventListener('click', () => {
      hspChecker.classList.remove('hidden');
      nomadChecker.classList.add('hidden');
      hspBtn.classList.add('text-[#008080]', 'border-b-4', 'border-[#008080]');
      nomadBtn.classList.remove('text-[#008080]', 'border-b-4', 'border-[#008080]');
    });

    nomadBtn.addEventListener('click', () => {
      nomadChecker.classList.remove('hidden');
      hspChecker.classList.add('hidden');
      nomadBtn.classList.add('text-[#008080]', 'border-b-4', 'border-[#008080]');
      hspBtn.classList.remove('text-[#008080]', 'border-b-4', 'border-[#008080]');
    });
  }

  fetch(`${sheetBase}/visa_comparison`)
    .then(res => res.json())
    .then(data => {
      const table = document.getElementById("visa-comparison-table")?.querySelector("tbody");
      if (!table) return;
      data.forEach(row => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td class="p-3 border">${row.item}</td>
          <td class="p-3 border">${row.hsp}</td>
          <td class="p-3 border">${row.nomad}</td>
        `;
        table.appendChild(tr);
      });
    });

  const nomadForm = document.getElementById('nomad-form');
  const nomadResult = document.getElementById('nomad-result-text');
  if (nomadForm && nomadResult) {
    nomadForm.addEventListener('change', () => {
      const q1 = nomadForm.q1?.value;
      const q2 = nomadForm.q2?.value;
      const q3 = nomadForm.q3?.value;
      const q4 = nomadForm.q4?.value;
      if (!q1 || !q2 || !q3 || !q4) return;

      let html = '', bg = 'bg-gray-100';
      if (q1 === 'yes' && q2 === 'yes' && q3 === 'yes' && q4 === 'yes') {
        html = '<strong class="text-green-800 text-base">素晴らしい！</strong><br>要件を満たしています。';
        bg = 'bg-green-100';
      } else {
        const fails = [];
        if (q1 !== 'yes') fails.push('国籍');
        if (q2 !== 'yes') fails.push('年収');
        if (q3 !== 'yes') fails.push('就労形態');
        if (q4 !== 'yes') fails.push('医療保険');
        html = `<strong class="text-yellow-800 text-base">要件未達</strong><br>「${fails.join('、')}」が未達です。`;
        bg = 'bg-yellow-100';
      }
      nomadResult.innerHTML = `<p>${html}</p>`;
      nomadResult.className = `mt-8 p-6 rounded text-center min-h-[100px] flex items-center justify-center text-sm ${bg}`;
    });
  }

  Promise.all([
    fetch(`${sheetBase}/support_items`).then(res => res.json()),
    fetch(`${sheetBase}/support_vendors`).then(res => res.json())
  ]).then(([items, vendors]) => {
    const form = document.getElementById("needs-assessment-form");
    const plan = document.getElementById("action-plan");
    const content = document.getElementById("action-plan-content");

    if (!form || !plan || !content) return;

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const selected = Array.from(document.querySelectorAll("input[name='needs']:checked")).map(cb => cb.value);
      content.innerHTML = "";

      const matches = items.filter(i => selected.includes(i.id));
      if (matches.length > 0) {
        matches.forEach(i => {
          const related = vendors.filter(v => v.support_id === i.id);
          const card = document.createElement("div");
          card.className = "bg-white p-6 rounded-lg shadow-md border-l-4 border-[#008080]";
          card.innerHTML = `
            <h4 class="font-bold text-xl mb-2">${i.title_ja}</h4>
            <p class="text-gray-700">${i.solution_ja}</p>
            <ul class="list-disc list-inside mt-3 space-y-1 text-sm text-blue-700">
              ${related.map(v => `<li><a href="${v.website}" target="_blank" class="hover:underline">${v.name}</a>: ${v.description}</li>`).join("")}
            </ul>
          `;
          content.appendChild(card);
        });
        plan.classList.remove("hidden");
        plan.scrollIntoView({ behavior: "smooth" });
      } else {
        plan.classList.add("hidden");
      }
    });
  });
});
