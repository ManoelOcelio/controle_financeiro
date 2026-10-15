import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import {
    getAuth,
    onAuthStateChanged,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signOut
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyBgj6dc0vu57f4hsIko-ZWjBBwT7cmKzwo",
    authDomain: "contas-mensais-1e667.firebaseapp.com",
    projectId: "contas-mensais-1e667",
    storageBucket: "contas-mensais-1e667.firebasestorage.app",
    messagingSenderId: "300122598862",
    appId: "1:300122598862:web:af864ffd2973a7fab94f9f"
};
const fbApp = initializeApp(firebaseConfig);
const auth = getAuth(fbApp);
const db = getFirestore(fbApp);

const KEY = "contas-v3";
let S = { lanc: [], pagos: {}, conta: {}, cartoes: [], compras: [], faturas: {} };

try {
    const r = localStorage.getItem(KEY);
    if (r) {
        Object.assign(S, JSON.parse(r));
    } else {
        const o = JSON.parse(localStorage.getItem("contas-v2") || "null");
        if (o) {
            const m = (x, f) => ({
                id: x.id,
                tipo: x.tipo,
                nome: x.cat + (x.desc ? " - " + x.desc : ""),
                valor: x.valor,
                data: x.data,
                fixo: f,
                res: x.cat === "Aluguel"
            });
            S.lanc = [
                ...(o.dados || []).map(x => m(x, false)),
                ...(o.fixos || []).map(x => m(x, true))
            ];
        }
    }
} catch (e) {}

const $ = id => document.getElementById(id);
const brl = v => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const pad = n => String(n).padStart(2, "0");
const ym = s => +s.slice(0, 4) * 12 + +s.slice(5, 7) - 1;
const dia = s => +s.slice(8, 10);
const dm = s => s.slice(8, 10) + "/" + s.slice(5, 7);
const dmes = (m, d) => {
    const l = new Date(+m.slice(0, 4), +m.slice(5, 7), 0).getDate();
    return m + "-" + pad(Math.min(d, l));
};
const sum = a => Math.round(a.reduce((s, x) => s + x.valor, 0) * 100) / 100;
const par = c => Math.round(c.valor / c.n * 100) / 100;

const _t = new Date(),
    _n = new Date(_t.getFullYear(), _t.getMonth() + 1, 1),
    hoje = dmes(_n.getFullYear() + "-" + pad(_n.getMonth() + 1), _t.getDate());
let ed = {},
    pend = "";

let usuario = null,
    carregado = false;

const save = () => {
    if (!usuario || !carregado) return;
    setDoc(doc(db, "users", usuario.uid), {
        data: JSON.stringify(S),
        atualizado: Date.now()
    }).catch(e => alert("Não foi possível salvar na nuvem: " + e.message));
};

const nm = new Date();
nm.setDate(1);
nm.setMonth(nm.getMonth() + 1);
$("mes").value = nm.getFullYear() + "-" + pad(nm.getMonth() + 1);
$("data").value = hoje;
$("pdata").value = hoje;

$("pn").innerHTML = Array.from({ length: 48 }, (_, i) => i + 1)
    .map(n => `<option value="${n}">${n === 1 ? "À vista (1x)" : n + "x"}</option>`)
    .join("");

const tp = () => document.querySelector('input[name="tipo"]:checked').value;
document.querySelectorAll('input[name="tipo"]').forEach(r => {
    r.onchange = () => {
        $("resw").hidden = tp() !== "d";
    };
});

function calc(m) {
    const mi = ym(m + "-01");
    const L = S.lanc
        .filter(x => x.fixo ? ym(x.data) <= mi : x.data.startsWith(m))
        .map(x => ({
            ...x,
            k: "l",
            data: x.fixo ? dmes(m, dia(x.data)) : x.data,
            key: "l" + x.id + ":" + m
        }));
    const C = S.cartoes.map(c => {
        const it = S.compras
            .filter(p => p.cartao === c.id)
            .map(p => ({ ...p, i: mi - ym(p.prim), par: par(p) }))
            .filter(p => p.i >= 0 && p.i < p.n);
        const emp = Math.round(it.reduce((s, p) => s + p.par, 0) * 100) / 100,
            fat = S.faturas[c.id + ":" + m];
        return {
            c,
            it,
            emp,
            fat,
            meu: fat == null ? null : Math.round((fat - emp) * 100) / 100
        };
    });
    const R = L.filter(x => x.tipo === "r");
    const D = [
        ...L.filter(x => x.tipo === "d"),
        ...C.filter(x => x.meu != null).map(x => ({
            k: "c",
            id: x.c.id,
            nome: x.c.nome,
            valor: x.meu,
            data: dmes(m, x.c.dia),
            key: "c" + x.c.id + ":" + m,
            auto: 1
        }))
    ].sort((a, b) => a.data.localeCompare(b.data));
    const ca = Math.round((
        sum(L.filter(x => x.tipo === "d" && x.res)) +
        C.filter(x => x.c.res && x.fat != null).reduce((s, x) => s + x.fat, 0)
    ) * 100) / 100;
    return { R, D, C, rec: sum(R), des: sum(D), ca };
}

function btns(k, id) {
    const key = k + id;
    return pend === key
        ? `<button class="q" data-a="del" data-k="${k}" data-id="${id}">Excluir?</button>`
        : `<button title="Editar" data-a="edit" data-k="${k}" data-id="${id}">✎</button><button title="Excluir" data-a="del" data-k="${k}" data-id="${id}">✕</button>`;
}

const ck = key => `<label class="ck"><input type="checkbox" data-pk="${esc(key)}"${S.pagos[key] ? " checked" : ""}><small>${S.pagos[key] ? "Pago" : "Não pago"}</small></label>`;

const li = (x, c) => `<li class="${S.pagos[x.key] ? "pg" : ""}">${c ? ck(x.key) : ""}<span class="n">${esc(x.nome)}${x.fixo ? '<span class="tag">🔁</span>' : ""}${x.auto ? '<span class="tag">🏦 minha parte</span>' : ""}</span><span class="d">${dm(x.data)}</span><span class="v">${brl(x.valor)}</span><span class="ac">${x.auto ? "" : btns(x.k, x.id)}</span></li>`;

const cor = (el, v) => {
    el.textContent = brl(v);
    el.className = v < 0 ? "neg" : "pos";
};

function render() {
    const m = $("mes").value,
        r = calc(m);

    $("lr").innerHTML = r.R.length
        ? r.R.map(x => li(x, 0)).join("")
        : '<p class="vazio">Nenhuma receita neste mês.</p>';
    $("ld").innerHTML = r.D.length
        ? r.D.map(x => li(x, 1)).join("")
        : '<p class="vazio">Nenhuma despesa neste mês.</p>';

    $("tr").textContent = brl(r.rec);
    $("td").textContent = brl(r.des);
    cor($("ts"), r.rec - r.des);
    $("tca").textContent = brl(r.ca);
    if (document.activeElement !== $("conta")) $("conta").value = S.conta[m] ?? "";
    cor($("tres"), (S.conta[m] || 0) - r.ca);

    $("cartoes").innerHTML = r.C.length ? r.C.map(x => {
        const pp = {};
        x.it.forEach(p => {
            const a = pp[p.pessoa] = pp[p.pessoa] || [0, 0];
            a[0] += p.par;
            if (!S.pagos["g" + x.c.id + ":" + p.pessoa + ":" + m]) a[1] += p.par;
        });
        return `<section class="card"><div class="ch"><h3>${esc(x.c.nome)} <small>· vence dia ${x.c.dia}</small></h3><span class="ac">${btns("c", x.c.id)}</span></div>
${x.it.length ? Object.keys(pp).sort((a, b) => a.localeCompare(b)).map(n => {
            const [t, f] = pp[n];
            return `<div class="grp${S.pagos["g" + x.c.id + ":" + n + ":" + m] ? " gpg" : ""}"><div class="gh"><div style="display:flex;align-items:center;gap:8px">${ck("g" + x.c.id + ":" + n + ":" + m)}<h4>${esc(n)}</h4></div><div class="chip"><small>Total ${esc(n)}</small><b>${brl(t)}</b><small>${f > 0 ? "falta " + brl(f) : "recebido ✓"}</small></div></div><ul>${x.it.filter(p => p.pessoa === n).map(p => {
                const k = "p" + p.id + ":" + m;
                return `<li><span class="n">${p.desc ? esc(p.desc) : "Compra"}${p.n > 1 ? `<span class="tag">${p.i + 1}/${p.n}</span>` : ""}</span><span class="v">${brl(p.par)}</span><span class="ac">${btns("p", p.id)}</span></li>`;
            }).join("")}</ul></div>`;
        }).join("") : '<p class="vazio">Sem compras emprestadas neste mês.</p>'}

<div class="tot bad"><span>Empréstimo</span><b class="neg">${brl(x.emp)}</b></div>
<div class="tot"><span>Fatura do mês</span><input type="number" step="0.01" data-fat="${x.c.id}" value="${x.fat ?? ""}" placeholder="0,00"></div>
<div class="tot"><span>Total (minha parte)</span><b>${x.meu == null ? '<small style="font-weight:400">informe a fatura</small>' : brl(x.meu)}</b></div></section>`;
    }).join("") : "";

    const cur = $("pcar").value;
    $("pcar").innerHTML = S.cartoes.map(c => `<option value="${c.id}">${esc(c.nome)}</option>`).join("");
    if (cur) $("pcar").value = cur;
    $("pnomes").innerHTML = [...new Set(S.compras.map(p => p.pessoa))]
        .map(n => `<option value="${esc(n)}">`)
        .join("");
    $("pf").hidden = !S.cartoes.length;
    $("pmsg").hidden = S.cartoes.length > 0;
}

$("f").onsubmit = e => {
    e.preventDefault();
    const v = parseFloat($("valor").value);
    if (!(v > 0)) return;
    const it = {
        id: ed.l || Date.now(),
        tipo: tp(),
        nome: $("nome").value.trim(),
        valor: v,
        data: $("data").value,
        fixo: $("rep").checked,
        res: tp() === "d" && $("res").checked
    };
    S.lanc = S.lanc.filter(x => x.id !== it.id);
    S.lanc.push(it);
    save();
    $("mes").value = it.data.slice(0, 7);
    flimpar();
    render();
};

function flimpar() {
    delete ed.l;
    $("f").reset();
    $("data").value = hoje;
    $("resw").hidden = false;
    $("ftit").textContent = "Novo lançamento";
    $("fbtn").textContent = "Adicionar";
    $("fcan").hidden = true;
}
$("fcan").onclick = flimpar;

function pprev() {
    const v = parseFloat($("pvalor").value),
        n = +$("pn").value;
    $("pprev").innerHTML = v > 0
        ? (n === 1 ? `<b>${brl(v)}</b> à vista` : `<b>${n}x de ${brl(par({ valor: v, n }))}</b>`)
        : "Preencha o valor para ver a parcela.";
}
$("pvalor").oninput = $("pn").onchange = pprev;

$("pf").onsubmit = e => {
    e.preventDefault();
    const v = parseFloat($("pvalor").value);
    if (!(v > 0)) return;
    const p = {
        id: ed.p || Date.now(),
        cartao: +$("pcar").value,
        pessoa: $("ppes").value.trim(),
        desc: $("pdesc").value.trim(),
        valor: v,
        n: +$("pn").value,
        prim: $("pdata").value
    };
    S.compras = S.compras.filter(x => x.id !== p.id);
    S.compras.push(p);
    save();
    $("mes").value = p.prim.slice(0, 7);
    plimpar();
    render();
};

function plimpar() {
    delete ed.p;
    const c = $("pcar").value;
    $("pf").reset();
    $("pcar").value = c;
    $("pdata").value = hoje;
    $("ptit").textContent = "Nova compra no cartão";
    $("pbtn").textContent = "Adicionar compra";
    $("pcan").hidden = true;
    pprev();
}
$("pcan").onclick = plimpar;

$("cf").onsubmit = e => {
    e.preventDefault();
    const c = {
        id: ed.c || Date.now(),
        nome: $("cnome").value.trim(),
        dia: Math.min(31, Math.max(1, +$("cdia").value)),
        res: $("cres").checked
    };
    const i = S.cartoes.findIndex(x => x.id === c.id);
    if (i >= 0) S.cartoes[i] = c;
    else S.cartoes.push(c);
    save();
    climpar();
    render();
};

function climpar() {
    delete ed.c;
    $("cf").reset();
    $("cres").checked = true;
    $("ctit").textContent = "Novo cartão";
    $("cbtn").textContent = "Adicionar cartão";
    $("ccan").hidden = true;
}
$("ccan").onclick = climpar;

document.addEventListener("click", e => {
    const b = e.target.closest("[data-a]");
    if (!b) return;
    const { a, k } = b.dataset,
        id = +b.dataset.id,
        key = k + id;

    if (a === "del") {
        if (pend !== key) {
            pend = key;
            render();
            return;
        }
        pend = "";
        if (k === "l") {
            S.lanc = S.lanc.filter(x => x.id !== id);
        } else if (k === "p") {
            S.compras = S.compras.filter(x => x.id !== id);
        } else {
            S.cartoes = S.cartoes.filter(x => x.id !== id);
            S.compras = S.compras.filter(x => x.cartao !== id);
        }
        save();
        render();
        return;
    }

    pend = "";
    if (k === "l") {
        const x = S.lanc.find(y => y.id === id);
        ed.l = id;
        document.querySelector(`input[name="tipo"][value="${x.tipo}"]`).checked = true;
        $("nome").value = x.nome;
        $("valor").value = x.valor;
        $("data").value = x.data;
        $("rep").checked = !!x.fixo;
        $("res").checked = !!x.res;
        $("resw").hidden = x.tipo !== "d";
        $("ftit").textContent = x.fixo ? "Editando (vale para todos os meses)" : "Editando lançamento";
        $("fbtn").textContent = "Salvar alterações";
        $("fcan").hidden = false;
        $("ftit").scrollIntoView({ behavior: "smooth" });
    } else if (k === "p") {
        const x = S.compras.find(y => y.id === id);
        ed.p = id;
        $("pcar").value = x.cartao;
        $("ppes").value = x.pessoa;
        $("pdesc").value = x.desc;
        $("pvalor").value = x.valor;
        $("pn").value = x.n;
        $("pdata").value = x.prim;
        $("ptit").textContent = "Editando compra";
        $("pbtn").textContent = "Salvar alterações";
        $("pcan").hidden = false;
        pprev();
        $("ptit").scrollIntoView({ behavior: "smooth" });
    } else {
        const x = S.cartoes.find(y => y.id === id);
        ed.c = id;
        $("cnome").value = x.nome;
        $("cdia").value = x.dia;
        $("cres").checked = x.res;
        $("ctit").textContent = "Editando cartão";
        $("cbtn").textContent = "Salvar alterações";
        $("ccan").hidden = false;
        $("ctit").scrollIntoView({ behavior: "smooth" });
    }
});

document.addEventListener("change", e => {
    const t = e.target,
        m = $("mes").value;
    if (t.dataset.pk) {
        if (t.checked) S.pagos[t.dataset.pk] = 1;
        else delete S.pagos[t.dataset.pk];
    } else if (t.dataset.fat) {
        const k = t.dataset.fat + ":" + m;
        if (t.value === "") delete S.faturas[k];
        else S.faturas[k] = parseFloat(t.value);
    } else if (t.id === "conta") {
        if (t.value === "") delete S.conta[m];
        else S.conta[m] = parseFloat(t.value);
    } else {
        return;
    }
    save();
    render();
});

$("mes").onchange = () => {
    pend = "";
    render();
};

const loginMsg = t => {
    $("lmsg").textContent = t;
};

const erroAuth = e => ({
    "auth/invalid-credential": "E-mail ou senha incorretos.",
    "auth/invalid-email": "E-mail inválido.",
    "auth/email-already-in-use": "Este e-mail já está cadastrado.",
    "auth/weak-password": "A senha precisa ter pelo menos 6 caracteres.",
    "auth/missing-password": "Digite a senha.",
    "auth/too-many-requests": "Muitas tentativas. Tente novamente mais tarde."
}[e.code] || "Erro: " + e.message);

$("lf").onsubmit = e => {
    e.preventDefault();
    loginMsg("");
    signInWithEmailAndPassword(auth, $("lemail").value.trim(), $("lsenha").value)
        .catch(err => loginMsg(erroAuth(err)));
};

$("lcriar").onclick = () => {
    loginMsg("");
    if (!$("lemail").value.trim() || !$("lsenha").value) {
        loginMsg("Preencha e-mail e senha para criar a conta.");
        return;
    }
    createUserWithEmailAndPassword(auth, $("lemail").value.trim(), $("lsenha").value)
        .catch(err => loginMsg(erroAuth(err)));
};

$("sair").onclick = () => signOut(auth).then(() => location.reload());

onAuthStateChanged(auth, async user => {
    usuario = user;
    carregado = false;
    $("login").hidden = !!user;
    $("app").hidden = !user;
    if (!user) return;
    try {
        const snap = await getDoc(doc(db, "users", user.uid));
        if (snap.exists()) {
            S = {
                lanc: [], pagos: {}, conta: {}, cartoes: [], compras: [], faturas: {},
                ...JSON.parse(snap.data().data)
            };
        }
        carregado = true;
        if (!snap.exists()) save();
    } catch (err) {
        alert("Não foi possível carregar seus dados: " + err.message);
    }
    render();
});
