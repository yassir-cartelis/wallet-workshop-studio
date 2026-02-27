/* Wallet Workshop Studio - v2 (front only)
   - Vue 3 global build
   - Tailwind via CDN
   - JSZip + LZ-String via CDN
*/

const { createApp } = Vue;

function uid(prefix="id") {
  return prefix + "_" + Math.random().toString(16).slice(2) + "_" + Date.now().toString(16);
}

function safeJsonParse(str, fallback=null) {
  try { return JSON.parse(str); } catch { return fallback; }
}

function sanitizeFilename(name) {
  return String(name || "wallet_spec")
    .trim()
    .replace(/[^\w\-]+/g, "_")
    .replace(/_+/g, "_")
    .slice(0, 80) || "wallet_spec";
}

function bytesToHex(bytes) {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, "0")).join("");
}

function bytesToBase64(bytes) {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function base64ToBytes(b64) {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function sha256Hex(input) {
  const enc = new TextEncoder();
  const buf = await crypto.subtle.digest("SHA-256", enc.encode(input));
  return bytesToHex(new Uint8Array(buf));
}

function pkcs7Pad(bytes, blockSize=16) {
  const padLen = blockSize - (bytes.length % blockSize || blockSize);
  const out = new Uint8Array(bytes.length + padLen);
  out.set(bytes, 0);
  out.fill(padLen, bytes.length);
  return out;
}

function zeroPad(bytes, blockSize=16) {
  const padLen = (bytes.length % blockSize === 0) ? 0 : (blockSize - (bytes.length % blockSize));
  const out = new Uint8Array(bytes.length + padLen);
  out.set(bytes, 0);
  // remaining bytes are zero
  return out;
}

async function aes256cbcEncryptBase64(plaintext, keyB64, ivB64, padding="pkcs7") {
  const enc = new TextEncoder();
  let data = enc.encode(plaintext);

  const keyRaw = base64ToBytes(keyB64);
  const ivRaw = base64ToBytes(ivB64);

  if (keyRaw.length !== 32) throw new Error("AES key must be 32 bytes (base64 decode)");
  if (ivRaw.length !== 16) throw new Error("IV must be 16 bytes (base64 decode)");

  if (padding === "pkcs7") data = pkcs7Pad(data, 16);
  if (padding === "zero") data = zeroPad(data, 16);

  const key = await crypto.subtle.importKey(
    "raw",
    keyRaw,
    { name: "AES-CBC" },
    false,
    ["encrypt"]
  );

  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-CBC", iv: ivRaw },
    key,
    data
  );

  return bytesToBase64(new Uint8Array(ciphertext));
}

function csvEscape(v) {
  const s = String(v ?? "");
  if (/[",\n;]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

function buildMarkdownTable(headers, rows) {
  const headerLine = `| ${headers.join(" | ")} |`;
  const sepLine = `| ${headers.map(() => "---").join(" | ")} |`;
  const rowLines = rows.map(r => `| ${r.map(x => String(x ?? "")).join(" | ")} |`);
  return [headerLine, sepLine, ...rowLines].join("\n");
}

function nowIso() {
  return new Date().toISOString();
}

createApp({
  data() {
    return {
      currentStep: 1,
      activeTab: "entrypoints",
      steps: [
        { id: 1, label: "Contexte", hint: "Périmètre, OS, timezone, participants." },
        { id: 2, label: "Parcours & CTA", hint: "Canaux, contextes, desktop/QR." },
        { id: 3, label: "Entrypoints", hint: "IDs, campagnes, paramètres URL." },
        { id: 4, label: "Sécurité URL", hint: "Aucune / SHA256 / AES." },
        { id: 5, label: "Data contract", hint: "Mapping, formats, enum." },
        { id: 6, label: "Flux & Interfaces", hint: "API/SFTP, endpoints, auth." },
        { id: 7, label: "Notifications", hint: "Triggers, messages, contraintes." },
        { id: 8, label: "Recette & Collaboration", hint: "Erreurs, tests, décisions." },
      ],
      tabs: [
        { id: "entrypoints", label: "Entrypoints" },
        { id: "payloads", label: "Payloads" },
        { id: "contracts", label: "Contracts" },
        { id: "errors", label: "Errors" },
        { id: "spec", label: "Spec JSON" },
      ],

      ui: {
        viewMode: "atelier", // atelier | tech
        importModal: false,
        importText: "",
        importError: "",
        logTab: "decisions",
        toast: ""
      },

      project: {
        name: "Carte Suivi de livraison",
        brand: "Colissimo",
        description: "Carte Wallet multi-statuts pour suivre une livraison (iOS/Android).",
        timezone: "Europe/Paris",
        platforms: ["ios", "android"],
        languages: ["fr", "en"],
        workshop: {
          sessions: [
            { id: uid("session"), date: "", goal: "Atelier cadrage" },
            { id: uid("session"), date: "", goal: "Atelier technique" },
          ],
          participants: [
            { id: uid("p"), name: "Métier", role: "Owner", team: "Brand" },
            { id: uid("p"), name: "Tech", role: "Integration", team: "IT" },
          ]
        }
      },

      journey: {
        contexts: { authenticated: true, unauthenticated: false },
        touchpoints: [
          { id: uid("tp"), channel: "email", context: "authenticated", ctaLabelFr: "Ajouter au Wallet", ctaLabelEn: "Add to Wallet", notes: "" },
          { id: uid("tp"), channel: "web", context: "authenticated", ctaLabelFr: "Ajouter au Wallet", ctaLabelEn: "Add to Wallet", notes: "" },
        ],
        desktop: { useLandingWithQr: true, notes: "Si clic desktop : afficher une landing avec QR code pour installation mobile." }
      },

      walletPlatform: {
        vendor: "Captain Wallet",
        baseDomain: "captainwallet.com",
        accountId: "colissimo",
        projectId: "fr_FR",
        campaigns: [
          { id: "loyalty", name: "Suivi livraison multi-statuts", type: "main", description: "" },
          { id: "void", name: "Carte anonymisée (void)", type: "void", description: "" },
        ]
      },

      entrypoint: {
        params: {
          identifier: "user[identifier]",
          channel: "channel",
          tag: "tag"
        },
        examples: {
          identifier: "123456789ABCD",
          channel: "email",
          tag: "newsletter"
        }
      },

      security: {
        mode: "sha256", // none | sha256 | aes256cbc
        urlEncodingRequired: true,
        sha256: {
          salt: "",
          computeWhere: "server",
          signatureParam: "signature",
          previewInBrowser: true
        },
        aes256cbc: {
          keyB64: "",
          ivB64: "",
          payloadTemplate: "identifier={{identifier}}&channel={{channel}}&tag={{tag}}",
          padding: "pkcs7",
          dataParam: "data",
          computeWhere: "server",
          previewInBrowser: false
        }
      },

      dataContract: {
        timezonePolicy: "Par défaut UTC. Si un autre fuseau est utilisé, le préciser et l'appliquer sur toutes les dates.",
        fields: [
          { id: uid("f"), sourceField: "TBD", walletField: "user.identifier", type: "string", format: "", required: true, description: "Identifiant pivot (colis).", example: "123456789ABCD" },
          { id: uid("f"), sourceField: "TBD", walletField: "user.status", type: "string", format: "", required: true, description: "Statut livraison.", example: "Acheminement" },
          { id: uid("f"), sourceField: "TBD", walletField: "user.dateLivraison", type: "date", format: "JJ/MM/AAAA", required: false, description: "Date livraison (format JJ/MM/AAAA).", example: "12/02/2026" },
          { id: uid("f"), sourceField: "TBD", walletField: "user.expediteur", type: "string", format: "", required: false, description: "Nom de l'expéditeur (max 25).", example: "Colissimo" },
          { id: uid("f"), sourceField: "TBD", walletField: "user.AdresseLieuDeRetrait", type: "string", format: "", required: false, description: "Adresse lieu de retrait (max 25).", example: "3 avenue du général de Gaulle" },
        ],
        enumsJson: `{
  "user.status": [
    "Commande confirmé",
    "Préparation commande",
    "Acheminement",
    "Prise en charge",
    "Livraison en Cours",
    "Commande livrée"
  ]
}`
      },

      flows: {
        update: { transport: "api", cwUpdateMode: "standard" }, // api|sftp + standard|webhook
        optin: { transport: "api" },
        anonymize: { transport: "api", voidCampaignId: "void" },
        merge: { transport: "api" },
      },

      interfaces: {
        captainWalletApi: {
          env: {
            dev: { oauthTokenUrl: "https://qlf-api.captainwallet.com/oauth/token", apiBaseUrl: "https://qlf-api.captainwallet.com" },
            prod: { oauthTokenUrl: "https://api.captainwallet.com/oauth/token", apiBaseUrl: "https://api.captainwallet.com" },
          },
          oauth: { scope: "pass-owner webhooks", tokenTtlSeconds: 3600, cacheRecommended: true }
        },
        sourceSystem: {
          name: "API Colissimo",
          apiBaseUrl: "TBD",
          timeoutSlaMs: 2000,
          authNote: "",
          endpoints: {
            getCustomer: "TBD",
            optin: "TBD",
            docs: ""
          }
        },
        sftp: {
          host: "sftp.captainwallet.com",
          port: 2432,
          toWalletDir: "/ToWallet",
          fromWalletDir: "/FromWallet",
          username: "",
          password: "",
          notes: "Identifiants fournis par Captain Wallet via canal sécurisé."
        },
        ipAllowlist: { note: "Voir la liste IP CW à jour et l'ajouter au firewall / WAF.", source: "" }
      },

            notifications: [
        { id: uid("n"), trigger: "Post installation", timing: "Immédiat", messages: { fr: "Votre carte est prête ✅", en: "Your pass is ready ✅" } },
        { id: uid("n"), trigger: "StatusChanged: Acheminement", timing: "À la mise à jour", messages: { fr: "Votre colis est pris en charge ✅", en: "Your parcel is on its way ✅" } },
      ],

            errors: [
        { id: uid("e"), code: "ER0", category: "functional", scenario: "Identifiant inconnu", messages: { fr: "Nous n'avons pu trouver les informations nécessaires à la création de votre carte. (Err. 0)", en: "We could not find the necessary information to build your card. (Err. 0)" }, retry: "no", owner: "Brand" },
        { id: uid("e"), code: "ER1", category: "functional", scenario: "Donnée obligatoire manquante / incomplète", messages: { fr: "Nous ne possédons pas toutes les informations nécessaires à la création de votre carte. (Err. 1)", en: "We do not have all the information required to create your pass. (Err. 1)" }, retry: "no", owner: "Source System" },
        { id: uid("e"), code: "ER2", category: "external", scenario: "API indisponible / timeout", messages: { fr: "Ce service est momentanément indisponible. Merci de réessayer ultérieurement. (Err. 2)", en: "Sorry, we could not reach the services required to create your card. Please try again later. (Err. 2)" }, retry: "backoff", owner: "Source System" },
        { id: uid("e"), code: "ER3", category: "external", scenario: "Erreur technique (API retourne un code erreur)", messages: { fr: "Nous n'avons pu traiter votre demande. (Err. 3)", en: "We could not process your request. (Err. 3)" }, retry: "backoff", owner: "Tech" },
      ],

      testing: {
        acceptanceCriteriaText: "Encartement OK iOS/Android\nLanding desktop -> QR -> encartement OK\nOpt-in remonté via transport choisi\nUpdate status visible sur carte\nAnonymisation: bascule void + purge données",
        testCases: [
          { id: "TC01", title: "Encartement identifiant valide", expected: "Carte créée et installable" },
          { id: "TC02", title: "Encartement sans identifiant", expected: "Erreur affichée (ER1)" },
        ]
      },

      workshopLog: {
        decisions: [
          { id: "D1", date: nowIso().slice(0,10), area: "Sécurité", decision: "Signature SHA256 côté serveur", owner: "Tech", status: "done" }
        ],
        questions: [
          { id: "Q1", date: nowIso().slice(0,10), area: "Mapping", question: "Liste complète des champs & formats à confirmer", owner: "Métier", status: "open" }
        ],
        actions: [
          { id: "A1", date: nowIso().slice(0,10), area: "Interfaces", action: "Fournir baseUrl API source + auth + endpoints", owner: "Source", dueDate: "", status: "open" }
        ]
      },

      preview: {
        signature: "",
        aesData: "",
        securityError: ""
      }
    };
  },

  computed: {
    uiTitle() {
      const n = (this.project.name || "").trim();
      return n ? `Wallet Workshop Studio — ${n}` : "Wallet Workshop Studio";
    },

    stepLabel() {
      return this.steps.find(s => s.id === this.currentStep)?.label || "";
    },
    stepHint() {
      return this.steps.find(s => s.id === this.currentStep)?.hint || "";
    },

    flowsAnySftp() {
      return ["update","optin","anonymize","merge"].some(k => (this.flows[k]?.transport) === "sftp");
    },

    activeCampaignId() {
      const main = (this.walletPlatform.campaigns || []).find(c => c.type === "main") || (this.walletPlatform.campaigns || [])[0];
      return (main && main.id) ? main.id : "loyalty";
    },

    enumJsonError() {
      const t = (this.dataContract.enumsJson || "").trim();
      if (!t) return "";
      const obj = safeJsonParse(t, null);
      if (!obj || typeof obj !== "object") return "JSON invalide (enumérations)";
      return "";
    },

    dataContractResolved() {
      const enums = safeJsonParse((this.dataContract.enumsJson || "").trim() || "{}", {});
      return {
        timezonePolicy: this.dataContract.timezonePolicy,
        fields: this.dataContract.fields.map(f => ({
          sourceField: (f.sourceField || "").trim() || undefined,
          walletField: (f.walletField || "").trim(),
          type: f.type,
          format: (f.format || "").trim() || undefined,
          required: !!f.required,
          description: (f.description || "").trim() || undefined,
          example: (f.example || "").trim() || undefined,
        })),
        enums: enums
      };
    },

    mappingIssues() {
      const issues = [];
      const wf = this.dataContract.fields.map(f => (f.walletField || "").trim()).filter(Boolean);
      const duplicates = wf.filter((x, i) => wf.indexOf(x) !== i);
      if (duplicates.length) issues.push("Wallet fields dupliqués: " + [...new Set(duplicates)].join(", "));

      for (const f of this.dataContract.fields) {
        issues.push(...this.fieldIssues(f).map(x => `${(f.walletField || "?")}: ${x}`));
      }
      if (this.enumJsonError) issues.push(this.enumJsonError);
      return issues;
    },

    entrypointPreprod() {
      return this.buildEntrypointUrl("preprod");
    },
    entrypointProd() {
      return this.buildEntrypointUrl("prod");
    },

    optinEventExample() {
      return {
        [this.entrypoint.params.identifier || "user[identifier]"]: this.entrypoint.examples.identifier || "123456789ABCD",
        install_status: 1,
        event_date: new Date().toISOString(),
        channel: this.entrypoint.examples.channel || "email",
        tag: (this.entrypoint.examples.tag || "").trim() || undefined
      };
    },

    cwUpdatePayloadExample() {
      const metadatas = {};
      for (const f of this.dataContractResolved.fields) {
        const k = (f.walletField || "").trim();
        if (!k) continue;
        if (k === "user.identifier") continue;
        metadatas[k] = f.type === "date" ? new Date().toISOString() : (f.example ?? this.exampleValueForType(f.type));
      }
      metadatas.last_update = new Date().toISOString();

      return {
        metadatas,
        // optionnel selon vos templates CW :
        timezone: this.project.timezone
      };
    },

    anonymizePayloadExample() {
      return {
        identifiers: [ this.entrypoint.examples.identifier || "123456789ABCD" ],
        campaign: this.flows.anonymize.voidCampaignId || "void",
        event_date: new Date().toISOString(),
        reason: "user_request"
      };
    },

    mergePayloadExample() {
      return [
        {
          IDENTIFIER_SRC: "OLD_" + (this.entrypoint.examples.identifier || "123456789ABCD"),
          IDENTIFIER_DEST: this.entrypoint.examples.identifier || "123456789ABCD"
        }
      ];
    },

    openApiStubSnippet() {
      return this.renderOpenApiYaml(this.buildSpecObject(), true);
    },

    specSnapshot() {
      return this.buildSpecObject();
    },

    completeness() {
      let score = 0;
      const add = (cond, pts) => { if (cond) score += pts; };

      add(!!(this.project.name || "").trim(), 8);
      add(!!(this.project.brand || "").trim(), 6);
      add(!!this.project.timezone, 4);
      add((this.project.platforms || []).length > 0, 4);

      add(!!(this.walletPlatform.baseDomain || "").trim(), 6);
      add(!!(this.walletPlatform.accountId || "").trim(), 8);
      add(!!(this.walletPlatform.projectId || "").trim(), 8);
      add((this.walletPlatform.campaigns || []).length > 0, 6);

      add(!!(this.entrypoint.params.identifier || "").trim(), 5);
      add(!!(this.entrypoint.examples.identifier || "").trim(), 5);
      add(!!(this.entrypoint.examples.channel || "").trim(), 3);

      add(!!(this.security.mode || "").trim(), 4);

      add(this.dataContract.fields.length >= 1, 8);
      add(this.mappingIssues.length === 0, 8);

      add(!!(this.interfaces.sourceSystem.name || "").trim(), 6);
      add(!!(this.interfaces.captainWalletApi.env.dev.oauthTokenUrl || "").trim(), 2);
      add(!!(this.interfaces.captainWalletApi.env.prod.oauthTokenUrl || "").trim(), 2);

      if (this.flowsAnySftp) {
        add(!!(this.interfaces.sftp.host || "").trim(), 3);
        add(!!(this.interfaces.sftp.toWalletDir || "").trim(), 2);
        add(!!(this.interfaces.sftp.fromWalletDir || "").trim(), 2);
      } else {
        score += 7; // bonus "pas de sftp requis"
      }

      add(this.notifications.every(n => (n.trigger || "").trim() && ((n.messages?.fr || "").length <= 150) && !((n.messages?.fr || "").includes("http"))), 3);

      add(this.errors.length >= 1 && this.errors.every(e => (e.code || "").trim()), 3);

      add(this.workshopLog.decisions.length + this.workshopLog.questions.length + this.workshopLog.actions.length > 0, 2);

      return Math.min(100, Math.max(0, Math.round(score)));
    },

    topWarnings() {
      const w = [];

      if (!(this.project.name || "").trim()) w.push("Nom projet manquant.");
      if (!(this.project.brand || "").trim()) w.push("Brand/entité manquante.");
      if (!this.project.platforms.length) w.push("Au moins 1 OS cible est requis.");
      if (!(this.walletPlatform.accountId || "").trim()) w.push("accountId manquant (subdomain).");
      if (!(this.walletPlatform.projectId || "").trim()) w.push("projectId manquant.");
      if (!(this.walletPlatform.campaigns || []).length) w.push("Au moins 1 campagne est requise.");

      const voidCampaignId = (this.flows.anonymize.voidCampaignId || "").trim();
      if (voidCampaignId && !(this.walletPlatform.campaigns || []).some(c => c.id === voidCampaignId)) {
        w.push(`La campagne void "${voidCampaignId}" n'existe pas dans la liste des campagnes.`);
      }

      if (this.mappingIssues.length) w.push("Data contract: il reste des erreurs (mapping/dupliqués/enum JSON).");

      if (this.security.mode === "sha256" && this.security.sha256.computeWhere === "client") {
        w.push("SHA256 calculé côté navigateur : à éviter en prod (risque d'exposition du SALT).");
      }
      if (this.security.mode === "aes256cbc" && this.security.aes256cbc.computeWhere === "client") {
        w.push("AES calculé côté navigateur : à éviter en prod (clé/IV côté client).");
      }

      if (this.flowsAnySftp) {
        if (!(this.interfaces.sftp.host || "").trim()) w.push("SFTP requis par un flux mais host manquant.");
        if (!(this.interfaces.sftp.toWalletDir || "").trim()) w.push("SFTP requis : ToWallet directory manquant.");
        if (!(this.interfaces.sftp.fromWalletDir || "").trim()) w.push("SFTP requis : FromWallet directory manquant.");
      }

      // keep it short in header
      return w.slice(0, 4);
    }
  },

  watch: {
    project: { deep: true, handler() { this.persist(); } },
    journey: { deep: true, handler() { this.persist(); } },
    walletPlatform: { deep: true, handler() { this.persist(); this.refreshSecurityPreview(); } },
    entrypoint: { deep: true, handler() { this.persist(); this.refreshSecurityPreview(); } },
    security: { deep: true, handler() { this.persist(); this.refreshSecurityPreview(); } },
    dataContract: { deep: true, handler() { this.persist(); } },
    flows: { deep: true, handler() { this.persist(); } },
    interfaces: { deep: true, handler() { this.persist(); } },
    notifications: { deep: true, handler() { this.persist(); } },
    errors: { deep: true, handler() { this.persist(); } },
    testing: { deep: true, handler() { this.persist(); } },
    workshopLog: { deep: true, handler() { this.persist(); } },
  },

  async mounted() {
    this.restore();
    // Auto-import from share link hash (if present)
    this.importFromHash(true);
    await this.refreshSecurityPreview();
  },

  methods: {
    pretty(obj) { return JSON.stringify(obj, null, 2); },

    toast(msg) {
      // very lightweight: rely on native alert if clipboard fails; otherwise no UI.
      this.ui.toast = msg;
      setTimeout(() => { if (this.ui.toast === msg) this.ui.toast = ""; }, 2500);
    },

    exampleValueForType(t) {
      switch (t) {
        case "number": return 42;
        case "boolean": return true;
        case "date": return new Date().toISOString();
        case "object": return { example: true };
        case "array": return ["example"];
        default: return "value";
      }
    },

    fieldIssues(f) {
      const issues = [];
      const w = (f.walletField || "").trim();
      if (!w) issues.push("walletField manquant");
      if (w && /\s/.test(w)) issues.push("walletField contient des espaces");
      if (!(f.type || "").trim()) issues.push("type manquant");
      return issues;
    },

    isStepValid(stepId) {
      switch (stepId) {
        case 1:
          return !!(this.project.name || "").trim()
            && !!(this.project.brand || "").trim()
            && !!this.project.timezone
            && (this.project.platforms || []).length > 0;
        case 2:
          return (this.journey.touchpoints || []).length > 0
            && (this.journey.contexts.authenticated || this.journey.contexts.unauthenticated);
        case 3:
          return !!(this.walletPlatform.baseDomain || "").trim()
            && !!(this.walletPlatform.accountId || "").trim()
            && !!(this.walletPlatform.projectId || "").trim()
            && (this.walletPlatform.campaigns || []).length > 0
            && !!(this.entrypoint.params.identifier || "").trim()
            && !!(this.entrypoint.examples.identifier || "").trim();
        case 4:
          if (this.security.mode === "sha256") {
            if (this.security.sha256.previewInBrowser && !(this.security.sha256.salt || "").trim()) return false;
            return true;
          }
          if (this.security.mode === "aes256cbc") {
            if (this.security.aes256cbc.previewInBrowser) {
              return !!(this.security.aes256cbc.keyB64 || "").trim() && !!(this.security.aes256cbc.ivB64 || "").trim();
            }
            return true;
          }
          return true;
        case 5:
          return this.dataContract.fields.length > 0 && this.mappingIssues.length === 0;
        case 6:
          if (!(this.interfaces.sourceSystem.name || "").trim()) return false;
          if (this.flowsAnySftp) {
            return !!(this.interfaces.sftp.host || "").trim()
              && !!(this.interfaces.sftp.toWalletDir || "").trim()
              && !!(this.interfaces.sftp.fromWalletDir || "").trim();
          }
          return true;
        case 7:
          return this.notifications.every(n => (n.trigger || "").trim() && !((n.messages?.fr || "").includes("http")) && (n.messages?.fr || "").length <= 150);
        case 8:
          return true;
        default:
          return false;
      }
    },

    gotoStep(n) {
      this.currentStep = Math.min(this.steps.length, Math.max(1, n));
      if ([3,4].includes(this.currentStep)) this.activeTab = "entrypoints";
      if (this.currentStep === 5) this.activeTab = "contracts";
      if (this.currentStep === 6) this.activeTab = "contracts";
      if (this.currentStep === 7) this.activeTab = "payloads";
      if (this.currentStep === 8) this.activeTab = "errors";
    },
    nextStep() { this.gotoStep(this.currentStep + 1); },
    prevStep() { this.gotoStep(this.currentStep - 1); },

    // Adders
    addSession() {
      this.project.workshop.sessions.push({ id: uid("session"), date: "", goal: "" });
    },
    addParticipant() {
      this.project.workshop.participants.push({ id: uid("p"), name: "", role: "", team: "" });
    },
    addTouchpoint() {
      this.journey.touchpoints.push({ id: uid("tp"), channel: "email", context: "authenticated", ctaLabelFr: "", ctaLabelEn: "", notes: "" });
    },
    addCampaign() {
      this.walletPlatform.campaigns.push({ id: "", name: "", type: "adhoc", description: "" });
    },
    addField() {
      this.dataContract.fields.push({ id: uid("f"), sourceField: "", walletField: "", type: "string", format: "", required: false, description: "", example: "" });
    },
    addNotification() {
      this.notifications.push({ id: uid("n"), trigger: "", timing: "", messages: { fr: "", en: "" } });
    },
    addError() {
      this.errors.push({ id: uid("e"), code: "", category: "technical", scenario: "", messages: { fr: "", en: "" }, retry: "no", owner: "" });
    },
    addTestCase() {
      const nextIdx = this.testing.testCases.length + 1;
      this.testing.testCases.push({ id: `TC${String(nextIdx).padStart(2, "0")}`, title: "", expected: "" });
    },
    addDecision() {
      const nextIdx = this.workshopLog.decisions.length + 1;
      this.workshopLog.decisions.push({ id: `D${nextIdx}`, date: nowIso().slice(0,10), area: "", decision: "", owner: "", status: "open" });
    },
    addQuestion() {
      const nextIdx = this.workshopLog.questions.length + 1;
      this.workshopLog.questions.push({ id: `Q${nextIdx}`, date: nowIso().slice(0,10), area: "", question: "", owner: "", status: "open" });
    },
    addAction() {
      const nextIdx = this.workshopLog.actions.length + 1;
      this.workshopLog.actions.push({ id: `A${nextIdx}`, date: nowIso().slice(0,10), area: "", action: "", owner: "", dueDate: "", status: "open" });
    },

    // URL building
    baseHost(env) {
      const domain = (this.walletPlatform.baseDomain || "").trim();
      const accountId = (this.walletPlatform.accountId || "").trim();
      if (!domain || !accountId) return "";
      if (env === "preprod") return `https://qlf-${accountId}.${domain}`;
      return `https://${accountId}.${domain}`;
    },

    applyTemplate(tpl, vars) {
      let s = String(tpl || "");
      for (const [k,v] of Object.entries(vars || {})) {
        s = s.replaceAll(`{{${k}}}`, String(v ?? ""));
      }
      return s;
    },

    buildEntrypointUrl(env) {
      const base = this.baseHost(env);
      if (!base) return "—";
      const projectId = (this.walletPlatform.projectId || "").trim();
      const campaignId = (this.activeCampaignId || "").trim();
      const path = `/${encodeURIComponent(projectId)}/${encodeURIComponent(campaignId)}`;

      const enc = (v) => this.security.urlEncodingRequired ? encodeURIComponent(String(v ?? "")) : String(v ?? "");
      const params = [];

      const identifierParam = (this.entrypoint.params.identifier || "user[identifier]").trim();
      const channelParam = (this.entrypoint.params.channel || "channel").trim();
      const tagParam = (this.entrypoint.params.tag || "tag").trim();

      const identifierVal = (this.entrypoint.examples.identifier || "").trim();
      const channelVal = (this.entrypoint.examples.channel || "").trim();
      const tagVal = (this.entrypoint.examples.tag || "").trim();

      if (this.security.mode === "aes256cbc") {
        const dataParam = (this.security.aes256cbc.dataParam || "data").trim();
        const dataValue = this.preview.aesData || "{{data}}";
        params.push(`${enc(dataParam)}=${enc(dataValue)}`);
      } else {
        params.push(`${enc(identifierParam)}=${enc(identifierVal || "{{identifier}}")}`);
      }

      if (channelVal) params.push(`${enc(channelParam)}=${enc(channelVal)}`);
      if (tagVal) params.push(`${enc(tagParam)}=${enc(tagVal)}`);

      if (this.security.mode === "sha256") {
        const sigParam = (this.security.sha256.signatureParam || "signature").trim();
        const sigVal = this.preview.signature || "{{signature}}";
        params.push(`${enc(sigParam)}=${enc(sigVal)}`);
      }

      return `${base}${path}?${params.join("&")}`;
    },

    async refreshSecurityPreview() {
      this.preview.signature = "";
      this.preview.aesData = "";
      this.preview.securityError = "";

      const identifier = (this.entrypoint.examples.identifier || "").trim();
      const channel = (this.entrypoint.examples.channel || "").trim();
      const tag = (this.entrypoint.examples.tag || "").trim();

      try {
        if (this.security.mode === "sha256" && this.security.sha256.previewInBrowser) {
          const salt = (this.security.sha256.salt || "").trim();
          if (!salt || !identifier) return;
          this.preview.signature = await sha256Hex(identifier + salt);
        }

        if (this.security.mode === "aes256cbc" && this.security.aes256cbc.previewInBrowser) {
          const keyB64 = (this.security.aes256cbc.keyB64 || "").trim();
          const ivB64 = (this.security.aes256cbc.ivB64 || "").trim();
          if (!keyB64 || !ivB64 || !identifier) return;

          const payload = this.applyTemplate(this.security.aes256cbc.payloadTemplate, {
            identifier,
            channel,
            tag
          });

          const b64 = await aes256cbcEncryptBase64(payload, keyB64, ivB64, this.security.aes256cbc.padding || "pkcs7");
          this.preview.aesData = b64;
        }
      } catch (err) {
        this.preview.securityError = (err && err.message) ? err.message : String(err);
      }
    },

    // Spec building
    buildSpecObject() {
      const acceptanceCriteria = (this.testing.acceptanceCriteriaText || "")
        .split("\n")
        .map(x => x.trim())
        .filter(Boolean);

      const spec = {
        meta: { generatedAt: nowIso(), tool: "Wallet Workshop Studio", version: "2.0" },
        project: this.project,
        journey: this.journey,
        walletPlatform: this.walletPlatform,
        entrypoint: this.entrypoint,
        security: this.security,
        flows: this.flows,
        interfaces: this.interfaces,
        dataContract: this.dataContractResolved,
        notifications: this.notifications,
        errors: this.errors,
        testing: {
          acceptanceCriteria,
          testCases: this.testing.testCases
        },
        workshopLog: this.workshopLog,
        preview: {
          entrypointPreprod: this.entrypointPreprod,
          entrypointProd: this.entrypointProd
        }
      };

      return spec;
    },

    // Export helpers
    downloadBlob(blob, filename) {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      a.click();
      URL.revokeObjectURL(a.href);
    },

    exportJson() {
      const spec = this.buildSpecObject();
      const json = JSON.stringify(spec, null, 2);
      const blob = new Blob([json], { type: "application/json" });
      this.downloadBlob(blob, sanitizeFilename(this.project.name) + ".spec.json");
    },

    exportHtml() {
      const spec = this.buildSpecObject();
      const html = this.renderSpecHtml(spec);
      const w = window.open("", "_blank");
      if (!w) return;
      w.document.open();
      w.document.write(html);
      w.document.close();
    },

    async exportDevPackZip() {
      const spec = this.buildSpecObject();
      const zip = new JSZip();

      zip.file("spec.json", JSON.stringify(spec, null, 2));
      zip.file("SPEC.md", this.renderSpecMd(spec));
      zip.file("SPEC.html", this.renderSpecHtml(spec));
      zip.file("openapi_stub.yaml", this.renderOpenApiYaml(spec, false));
      zip.file("architecture.mmd", this.renderMermaid(spec));
      zip.file("notifications.md", this.renderNotificationsMd(spec));
      zip.file("error_playbook.md", this.renderErrorsMd(spec));
      zip.file("test_plan.md", this.renderTestPlanMd(spec));
      zip.file("WORKSHOP_LOG.md", this.renderWorkshopLogMd(spec));

      // data_contract.csv
      const headers = ["walletField", "sourceField", "type", "format", "required", "description", "example"];
      const lines = [
        headers.join(";"),
        ...spec.dataContract.fields.map(f => [
          csvEscape(f.walletField),
          csvEscape(f.sourceField || ""),
          csvEscape(f.type),
          csvEscape(f.format || ""),
          csvEscape(f.required ? "true" : "false"),
          csvEscape(f.description || ""),
          csvEscape(f.example || ""),
        ].join(";"))
      ];
      zip.file("data_contract.csv", lines.join("\n"));

      const blob = await zip.generateAsync({ type: "blob" });
      this.downloadBlob(blob, sanitizeFilename(this.project.name) + "_dev_pack.zip");
    },

    // Sharing
    async copyShareLink() {
      try {
        const spec = this.buildSpecObject();
        const payload = JSON.stringify(spec);
        const compressed = LZString.compressToEncodedURIComponent(payload);
        const newHash = `spec=${compressed}`;
        // keep path/query, just update hash
        const url = `${location.origin}${location.pathname}${location.search}#${newHash}`;
        // update current tab hash as well (so recipients can re-share)
        location.hash = newHash;

        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(url);
          alert("Lien copié dans le presse-papier ✅");
        } else {
          prompt("Copie ce lien :", url);
        }
      } catch (e) {
        alert("Impossible de générer le lien de partage : " + (e?.message || e));
      }
    },

    openImportModal() {
      this.ui.importModal = true;
      this.ui.importError = "";
      this.ui.importText = "";
    },

    importFromText() {
      this.ui.importError = "";
      const raw = (this.ui.importText || "").trim();
      if (!raw) return;
      const obj = safeJsonParse(raw, null);
      if (!obj) {
        this.ui.importError = "JSON invalide.";
        return;
      }
      this.applyImportedSpec(obj);
      this.ui.importModal = false;
      this.refreshSecurityPreview();
    },

    importFromFile(evt) {
      const file = evt.target.files && evt.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const obj = safeJsonParse(String(reader.result || ""), null);
        if (!obj) {
          this.ui.importError = "Fichier JSON invalide.";
          return;
        }
        this.applyImportedSpec(obj);
        this.ui.importModal = false;
        this.refreshSecurityPreview();
      };
      reader.readAsText(file);
    },

    importFromHash(silent=false) {
      const h = (location.hash || "").replace(/^#/, "");
      if (!h.startsWith("spec=")) return false;
      try {
        const compressed = h.slice("spec=".length);
        const json = LZString.decompressFromEncodedURIComponent(compressed);
        if (!json) return false;
        const obj = safeJsonParse(json, null);
        if (!obj) return false;
        this.applyImportedSpec(obj);
        if (!silent) alert("Spec importée depuis le lien ✅");
        return true;
      } catch (e) {
        if (!silent) alert("Impossible d'importer depuis le lien : " + (e?.message || e));
        return false;
      }
    },

    applyImportedSpec(spec) {
      // Soft-merge: only replace known sections if present.
      const setIf = (key) => { if (spec[key] !== undefined) this[key] = spec[key]; };

      // If spec is in our v2 structure
      setIf("project");
      setIf("journey");
      setIf("walletPlatform");
      setIf("entrypoint");
      setIf("security");
      setIf("flows");
      setIf("interfaces");
      if (spec.dataContract) {
        // accept resolved form
        this.dataContract.timezonePolicy = spec.dataContract.timezonePolicy || this.dataContract.timezonePolicy;
        this.dataContract.fields = (spec.dataContract.fields || []).map(f => ({
          id: uid("f"),
          sourceField: f.sourceField || "",
          walletField: f.walletField || "",
          type: f.type || "string",
          format: f.format || "",
          required: !!f.required,
          description: f.description || "",
          example: f.example || ""
        }));
        this.dataContract.enumsJson = JSON.stringify(spec.dataContract.enums || {}, null, 2);
      }
      setIf("notifications");
      setIf("errors");
      if (spec.testing) {
        this.testing.testCases = spec.testing.testCases || this.testing.testCases;
        const ac = spec.testing.acceptanceCriteria || [];
        this.testing.acceptanceCriteriaText = Array.isArray(ac) ? ac.join("\n") : (this.testing.acceptanceCriteriaText || "");
      }
      setIf("workshopLog");

      // Backward-compat: if older specSnapshot exists
      if (spec.specSnapshot && typeof spec.specSnapshot === "object") {
        const s = spec.specSnapshot;
        if (s.project) this.project = s.project;
      }
    },

    // HTML render
    renderSpecHtml(spec) {
      const esc = (s) => String(s ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
      const sectionTitle = (t) => `<h2 style="margin:22px 0 10px; font-size:16px;">${esc(t)}</h2>`;
      const li = (label, value) => `
        <div style="display:flex; gap:12px; padding:6px 0; border-bottom:1px solid #e2e8f0;">
          <div style="width:260px; color:#64748b; font-weight:700; text-transform:uppercase; font-size:11px; letter-spacing:1px;">${esc(label)}</div>
          <div style="flex:1; font-size:14px; color:#0f172a; font-weight:600; white-space:pre-wrap;">${esc(value)}</div>
        </div>`;

      const mappingRows = (spec.dataContract?.fields || []).map(f => `
        <tr>
          <td style="padding:8px; border-bottom:1px solid #e2e8f0;">${esc(f.walletField)}</td>
          <td style="padding:8px; border-bottom:1px solid #e2e8f0;">${esc(f.sourceField || "")}</td>
          <td style="padding:8px; border-bottom:1px solid #e2e8f0;">${esc(f.type)}</td>
          <td style="padding:8px; border-bottom:1px solid #e2e8f0;">${esc(f.format || "")}</td>
          <td style="padding:8px; border-bottom:1px solid #e2e8f0; text-align:center;">${f.required ? "✅" : "—"}</td>
          <td style="padding:8px; border-bottom:1px solid #e2e8f0;">${esc(f.description || "")}</td>
        </tr>
      `).join("");

      const notifRows = (spec.notifications || []).map(n => `
        <tr>
          <td style="padding:8px; border-bottom:1px solid #e2e8f0;">${esc(n.trigger)}</td>
          <td style="padding:8px; border-bottom:1px solid #e2e8f0;">${esc(n.timing || "")}</td>
          <td style="padding:8px; border-bottom:1px solid #e2e8f0;">${esc(n.messages?.fr || "")}</td>
          <td style="padding:8px; border-bottom:1px solid #e2e8f0;">${esc(n.messages?.en || "")}</td>
        </tr>
      `).join("");

      const errRows = (spec.errors || []).map(e => `
        <tr>
          <td style="padding:8px; border-bottom:1px solid #e2e8f0; font-weight:900;">${esc(e.code)}</td>
          <td style="padding:8px; border-bottom:1px solid #e2e8f0;">${esc(e.category)}</td>
          <td style="padding:8px; border-bottom:1px solid #e2e8f0;">${esc(e.scenario || "")}</td>
          <td style="padding:8px; border-bottom:1px solid #e2e8f0;">${esc(e.messages?.fr || "")}</td>
          <td style="padding:8px; border-bottom:1px solid #e2e8f0;">${esc(e.messages?.en || "")}</td>
          <td style="padding:8px; border-bottom:1px solid #e2e8f0;">${esc(e.retry || "")}</td>
          <td style="padding:8px; border-bottom:1px solid #e2e8f0;">${esc(e.owner || "")}</td>
        </tr>
      `).join("");

      const touchpointRows = (spec.journey?.touchpoints || []).map(t => `
        <tr>
          <td style="padding:8px; border-bottom:1px solid #e2e8f0;">${esc(t.channel)}</td>
          <td style="padding:8px; border-bottom:1px solid #e2e8f0;">${esc(t.context)}</td>
          <td style="padding:8px; border-bottom:1px solid #e2e8f0;">${esc(t.ctaLabelFr || "")}</td>
          <td style="padding:8px; border-bottom:1px solid #e2e8f0;">${esc(t.ctaLabelEn || "")}</td>
        </tr>
      `).join("");

      const campaignsRows = (spec.walletPlatform?.campaigns || []).map(c => `
        <tr>
          <td style="padding:8px; border-bottom:1px solid #e2e8f0; font-weight:800;">${esc(c.id)}</td>
          <td style="padding:8px; border-bottom:1px solid #e2e8f0;">${esc(c.type)}</td>
          <td style="padding:8px; border-bottom:1px solid #e2e8f0;">${esc(c.name)}</td>
        </tr>
      `).join("");

      return `
<!doctype html>
<html lang="fr"><head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>${esc(spec.project?.name || "Wallet Spec")}</title>
  <style>
    body { font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial; margin:0; background:#f8fafc; color:#0f172a; }
    .page { max-width: 1080px; margin: 24px auto; background:white; border:1px solid #e2e8f0; border-radius:18px; padding:22px; }
    .title { display:flex; justify-content:space-between; align-items:flex-start; gap:14px; }
    h1 { margin:0; font-size:22px; }
    .sub { margin-top:6px; color:#64748b; font-size:12px; text-transform:uppercase; letter-spacing:2px; font-weight:800; }
    h2 { margin:22px 0 10px; font-size:16px; }
    table { width:100%; border-collapse:collapse; }
    th { text-align:left; padding:8px; background:#f1f5f9; border-bottom:1px solid #e2e8f0; font-size:12px; text-transform:uppercase; letter-spacing:1px; }
    @media print { body { background:white; } .page { border:none; margin:0; border-radius:0; } .no-print { display:none; } }
  </style>
</head>
<body>
  <div class="page">
    <div class="title">
      <div>
        <h1>${esc(spec.project?.name || "Wallet Spec")}</h1>
        <div class="sub">${esc(spec.project?.brand || "")}</div>
      </div>
      <div class="no-print">
        <button onclick="window.print()" style="background:#2563eb;color:white;border:none;padding:10px 12px;border-radius:12px;font-weight:800;cursor:pointer;">
          Imprimer / PDF
        </button>
      </div>
    </div>

    ${sectionTitle("Contexte")}
    ${li("Description", spec.project?.description || "")}
    ${li("Timezone", spec.project?.timezone || "")}
    ${li("Platforms", (spec.project?.platforms || []).join(", "))}
    ${li("Languages", (spec.project?.languages || []).join(", "))}

    ${sectionTitle("Parcours & CTA")}
    <table>
      <thead><tr><th>Channel</th><th>Context</th><th>CTA FR</th><th>CTA EN</th></tr></thead>
      <tbody>${touchpointRows || `<tr><td style="padding:8px;" colspan="4">—</td></tr>`}</tbody>
    </table>
    ${li("Desktop → landing + QR", spec.journey?.desktop?.useLandingWithQr ? "yes" : "no")}
    ${li("Desktop notes", spec.journey?.desktop?.notes || "")}

    ${sectionTitle("Entrypoints")}
    ${li("Vendor", spec.walletPlatform?.vendor || "")}
    ${li("Base domain", spec.walletPlatform?.baseDomain || "")}
    ${li("accountId", spec.walletPlatform?.accountId || "")}
    ${li("projectId", spec.walletPlatform?.projectId || "")}
    <table>
      <thead><tr><th>campaignId</th><th>type</th><th>name</th></tr></thead>
      <tbody>${campaignsRows || `<tr><td style="padding:8px;" colspan="3">—</td></tr>`}</tbody>
    </table>

    ${li("PREPROD URL", spec.preview?.entrypointPreprod || "")}
    ${li("PROD URL", spec.preview?.entrypointProd || "")}

    ${sectionTitle("Sécurité URL")}
    ${li("Mode", spec.security?.mode || "")}
    ${li("URL encoding", spec.security?.urlEncodingRequired ? "required" : "not required")}
    ${spec.security?.mode === "sha256" ? li("Signature param", spec.security?.sha256?.signatureParam || "signature") : ""}
    ${spec.security?.mode === "aes256cbc" ? li("AES data param", spec.security?.aes256cbc?.dataParam || "data") : ""}

    ${sectionTitle("Flux & Interfaces")}
    ${li("Update transport", spec.flows?.update?.transport || "")}
    ${li("Opt-in transport", spec.flows?.optin?.transport || "")}
    ${li("Anonymize transport", spec.flows?.anonymize?.transport || "")}
    ${li("Merge transport", spec.flows?.merge?.transport || "")}
    ${li("Source system", spec.interfaces?.sourceSystem?.name || "")}
    ${li("Source API base", spec.interfaces?.sourceSystem?.apiBaseUrl || "")}
    ${li("Source SLA (ms)", spec.interfaces?.sourceSystem?.timeoutSlaMs || "")}
    ${li("CW OAuth DEV", spec.interfaces?.captainWalletApi?.env?.dev?.oauthTokenUrl || "")}
    ${li("CW OAuth PROD", spec.interfaces?.captainWalletApi?.env?.prod?.oauthTokenUrl || "")}

    ${spec.interfaces?.sftp ? sectionTitle("SFTP") : ""}
    ${spec.interfaces?.sftp ? li("Host", spec.interfaces.sftp.host) : ""}
    ${spec.interfaces?.sftp ? li("Port", spec.interfaces.sftp.port) : ""}
    ${spec.interfaces?.sftp ? li("ToWallet dir", spec.interfaces.sftp.toWalletDir) : ""}
    ${spec.interfaces?.sftp ? li("FromWallet dir", spec.interfaces.sftp.fromWalletDir) : ""}

    ${sectionTitle("Data contract")}
    ${li("Timezone policy", spec.dataContract?.timezonePolicy || "")}
    <table>
      <thead>
        <tr>
          <th>Wallet field</th><th>Source field</th><th>Type</th><th>Format</th><th>Required</th><th>Description</th>
        </tr>
      </thead>
      <tbody>${mappingRows || `<tr><td style="padding:8px;" colspan="6">—</td></tr>`}</tbody>
    </table>

    ${sectionTitle("Notifications")}
    <table>
      <thead><tr><th>Trigger</th><th>Timing</th><th>FR</th><th>EN</th></tr></thead>
      <tbody>${notifRows || `<tr><td style="padding:8px;" colspan="4">—</td></tr>`}</tbody>
    </table>

    ${sectionTitle("Playbook erreurs")}
    <table>
      <thead><tr><th>Code</th><th>Category</th><th>Scenario</th><th>FR</th><th>EN</th><th>Retry</th><th>Owner</th></tr></thead>
      <tbody>${errRows || `<tr><td style="padding:8px;" colspan="7">—</td></tr>`}</tbody>
    </table>

    ${sectionTitle("Recette")}
    ${li("Acceptance criteria", (spec.testing?.acceptanceCriteria || []).join("\n"))}

    ${sectionTitle("Workshop log")}
    ${li("Décisions", (spec.workshopLog?.decisions || []).map(d => `${d.id} · ${d.area} · ${d.decision}`).join("\n"))}
    ${li("Questions", (spec.workshopLog?.questions || []).map(q => `${q.id} · ${q.area} · ${q.status} · ${q.question}`).join("\n"))}
    ${li("Actions", (spec.workshopLog?.actions || []).map(a => `${a.id} · ${a.area} · ${a.status} · ${a.action}`).join("\n"))}

    <div style="margin-top:18px; color:#64748b; font-size:12px;">
      Généré le ${esc(new Date(spec.meta?.generatedAt || nowIso()).toLocaleString())}
    </div>
  </div>
</body></html>`;
    },

    // Markdown render (for Dev Pack)
    renderSpecMd(spec) {
      const lines = [];
      lines.push(`# ${spec.project?.name || "Wallet Spec"}`);
      lines.push(`**Brand:** ${spec.project?.brand || ""}`);
      lines.push(`**Generated at:** ${spec.meta?.generatedAt || ""}`);
      lines.push("");

      lines.push("## Contexte");
      lines.push(spec.project?.description || "");
      lines.push("");
      lines.push(`- Timezone: \`${spec.project?.timezone || ""}\``);
      lines.push(`- Platforms: ${(spec.project?.platforms || []).join(", ")}`);
      lines.push(`- Languages: ${(spec.project?.languages || []).join(", ")}`);
      lines.push("");

      lines.push("## Parcours & CTA");
      lines.push(buildMarkdownTable(
        ["Channel", "Context", "CTA FR", "CTA EN"],
        (spec.journey?.touchpoints || []).map(t => [t.channel, t.context, t.ctaLabelFr || "", t.ctaLabelEn || ""])
      ));
      lines.push("");
      lines.push(`- Desktop landing + QR: **${spec.journey?.desktop?.useLandingWithQr ? "yes" : "no"}**`);
      if (spec.journey?.desktop?.notes) lines.push(`- Notes: ${spec.journey.desktop.notes}`);
      lines.push("");

      lines.push("## Entrypoints");
      lines.push(`- Vendor: ${spec.walletPlatform?.vendor || ""}`);
      lines.push(`- Base domain: \`${spec.walletPlatform?.baseDomain || ""}\``);
      lines.push(`- accountId: \`${spec.walletPlatform?.accountId || ""}\``);
      lines.push(`- projectId: \`${spec.walletPlatform?.projectId || ""}\``);
      lines.push("");
      lines.push(buildMarkdownTable(
        ["campaignId", "type", "name"],
        (spec.walletPlatform?.campaigns || []).map(c => [c.id, c.type, c.name])
      ));
      lines.push("");
      lines.push(`- PREPROD URL: \`${spec.preview?.entrypointPreprod || ""}\``);
      lines.push(`- PROD URL: \`${spec.preview?.entrypointProd || ""}\``);
      lines.push("");

      lines.push("## Sécurité URL");
      lines.push(`- Mode: **${spec.security?.mode || ""}**`);
      lines.push(`- URL encoding: **${spec.security?.urlEncodingRequired ? "required" : "not required"}**`);
      if (spec.security?.mode === "sha256") {
        lines.push(`- Signature param: \`${spec.security?.sha256?.signatureParam || "signature"}\``);
        lines.push(`- Where computed: **${spec.security?.sha256?.computeWhere || ""}**`);
      }
      if (spec.security?.mode === "aes256cbc") {
        lines.push(`- Data param: \`${spec.security?.aes256cbc?.dataParam || "data"}\``);
        lines.push(`- Payload template (encrypted): \`${spec.security?.aes256cbc?.payloadTemplate || ""}\``);
        lines.push(`- Padding: **${spec.security?.aes256cbc?.padding || ""}**`);
        lines.push(`- Where computed: **${spec.security?.aes256cbc?.computeWhere || ""}**`);
      }
      lines.push("");

      lines.push("## Flux & Interfaces");
      lines.push(buildMarkdownTable(
        ["Flow", "Transport"],
        [
          ["Update (Source → Wallet)", spec.flows?.update?.transport || ""],
          ["Opt-in (Wallet → Source)", spec.flows?.optin?.transport || ""],
          ["Anonymize (Source → Wallet)", spec.flows?.anonymize?.transport || ""],
          ["Merge (Source → Wallet)", spec.flows?.merge?.transport || ""],
        ]
      ));
      lines.push("");
      lines.push(`- Source system: **${spec.interfaces?.sourceSystem?.name || ""}**`);
      lines.push(`- Source API base: \`${spec.interfaces?.sourceSystem?.apiBaseUrl || ""}\``);
      lines.push(`- Source SLA: **${spec.interfaces?.sourceSystem?.timeoutSlaMs || ""} ms**`);
      lines.push(`- CW OAuth DEV: \`${spec.interfaces?.captainWalletApi?.env?.dev?.oauthTokenUrl || ""}\``);
      lines.push(`- CW OAuth PROD: \`${spec.interfaces?.captainWalletApi?.env?.prod?.oauthTokenUrl || ""}\``);
      lines.push("");

      if (spec.interfaces?.sftp) {
        lines.push("### SFTP");
        lines.push(`- Host: \`${spec.interfaces.sftp.host || ""}\``);
        lines.push(`- Port: \`${spec.interfaces.sftp.port || ""}\``);
        lines.push(`- ToWalletDir: \`${spec.interfaces.sftp.toWalletDir || ""}\``);
        lines.push(`- FromWalletDir: \`${spec.interfaces.sftp.fromWalletDir || ""}\``);
        lines.push("");
      }

      lines.push("## Data contract");
      if (spec.dataContract?.timezonePolicy) lines.push(spec.dataContract.timezonePolicy);
      lines.push("");
      lines.push(buildMarkdownTable(
        ["walletField", "sourceField", "type", "format", "required", "description"],
        (spec.dataContract?.fields || []).map(f => [
          f.walletField,
          f.sourceField || "",
          f.type,
          f.format || "",
          f.required ? "true" : "false",
          (f.description || "").replace(/\n/g, " ")
        ])
      ));
      lines.push("");
      if (spec.dataContract?.enums && Object.keys(spec.dataContract.enums).length) {
        lines.push("### Enumérations");
        for (const [k,v] of Object.entries(spec.dataContract.enums)) {
          lines.push(`- \`${k}\`: ${Array.isArray(v) ? v.map(x => `"${x}"`).join(", ") : String(v)}`);
        }
        lines.push("");
      }

      lines.push("## Notifications");
      lines.push(buildMarkdownTable(
        ["Trigger", "Timing", "FR", "EN"],
        (spec.notifications || []).map(n => [n.trigger, n.timing || "", n.messages?.fr || "", n.messages?.en || ""])
      ));
      lines.push("");

      lines.push("## Playbook erreurs");
      lines.push(buildMarkdownTable(
        ["Code", "Category", "Scenario", "Retry", "Owner"],
        (spec.errors || []).map(e => [e.code, e.category, e.scenario || "", e.retry || "", e.owner || ""])
      ));
      lines.push("");

      lines.push("## Recette");
      lines.push("### Critères d'acceptation");
      for (const ac of (spec.testing?.acceptanceCriteria || [])) {
        lines.push(`- ${ac}`);
      }
      lines.push("");
      lines.push("### Cas de test");
      lines.push(buildMarkdownTable(
        ["ID", "Title", "Expected"],
        (spec.testing?.testCases || []).map(tc => [tc.id, tc.title || "", tc.expected || ""])
      ));
      lines.push("");

      lines.push("## Workshop log");
      lines.push("### Décisions");
      for (const d of (spec.workshopLog?.decisions || [])) lines.push(`- **${d.id}** · ${d.area || ""} · ${d.decision || ""} (owner: ${d.owner || ""})`);
      lines.push("");
      lines.push("### Questions");
      for (const q of (spec.workshopLog?.questions || [])) lines.push(`- **${q.id}** · ${q.area || ""} · **${q.status || ""}** · ${q.question || ""} (owner: ${q.owner || ""})`);
      lines.push("");
      lines.push("### Actions");
      for (const a of (spec.workshopLog?.actions || [])) lines.push(`- **${a.id}** · ${a.area || ""} · **${a.status || ""}** · ${a.action || ""} (owner: ${a.owner || ""}, due: ${a.dueDate || ""})`);
      lines.push("");

      return lines.join("\n");
    },

    renderNotificationsMd(spec) {
      const lines = [];
      lines.push("# Notifications");
      lines.push("");
      lines.push(buildMarkdownTable(
        ["Trigger", "Timing", "FR", "EN"],
        (spec.notifications || []).map(n => [n.trigger, n.timing || "", n.messages?.fr || "", n.messages?.en || ""])
      ));
      lines.push("");
      lines.push("## Contraintes");
      lines.push("- 150 caractères max (par langue)");
      lines.push("- Pas de lien (http/https)");
      lines.push("- Emojis autorisés (à valider côté produit)");
      lines.push("");
      return lines.join("\n");
    },

    renderErrorsMd(spec) {
      const lines = [];
      lines.push("# Error playbook");
      lines.push("");
      lines.push(buildMarkdownTable(
        ["Code", "Category", "Scenario", "FR", "EN", "Retry", "Owner"],
        (spec.errors || []).map(e => [
          e.code, e.category, e.scenario || "",
          (e.messages?.fr || "").replace(/\n/g, " "),
          (e.messages?.en || "").replace(/\n/g, " "),
          e.retry || "", e.owner || ""
        ])
      ));
      lines.push("");
      lines.push("## Recommandations");
      lines.push("- Documenter les HTTP status codes associés");
      lines.push("- Définir la stratégie de retry (client/serveur) et le backoff");
      lines.push("- Prévoir logs structurés + corrélation (request-id)");
      lines.push("");
      return lines.join("\n");
    },

    renderTestPlanMd(spec) {
      const lines = [];
      lines.push("# Test plan");
      lines.push("");
      lines.push("## Acceptance criteria");
      for (const ac of (spec.testing?.acceptanceCriteria || [])) lines.push(`- ${ac}`);
      lines.push("");
      lines.push("## Test cases");
      lines.push(buildMarkdownTable(
        ["ID", "Title", "Expected"],
        (spec.testing?.testCases || []).map(tc => [tc.id, tc.title || "", tc.expected || ""])
      ));
      lines.push("");
      lines.push("## Notes");
      lines.push("- Prévoir jeux de données (identifiants valides/invalides, statuts, dates)");
      lines.push("- Tester iOS + Android + desktop");
      lines.push("- Tester erreurs (ER0/ER1/ER2/…) et replays");
      lines.push("");
      return lines.join("\n");
    },

    renderWorkshopLogMd(spec) {
      const lines = [];
      lines.push("# Workshop log");
      lines.push("");
      lines.push("## Décisions");
      for (const d of (spec.workshopLog?.decisions || [])) lines.push(`- **${d.id}** · ${d.area || ""} · ${d.decision || ""} (owner: ${d.owner || ""})`);
      lines.push("");
      lines.push("## Questions");
      for (const q of (spec.workshopLog?.questions || [])) lines.push(`- **${q.id}** · ${q.area || ""} · **${q.status || ""}** · ${q.question || ""} (owner: ${q.owner || ""})`);
      lines.push("");
      lines.push("## Actions");
      for (const a of (spec.workshopLog?.actions || [])) lines.push(`- **${a.id}** · ${a.area || ""} · **${a.status || ""}** · ${a.action || ""} (owner: ${a.owner || ""}, due: ${a.dueDate || ""})`);
      lines.push("");
      return lines.join("\n");
    },

    renderMermaid(spec) {
      const accountId = spec.walletPlatform?.accountId || "accountId";
      const projectId = spec.walletPlatform?.projectId || "projectId";
      const campaignId = (spec.walletPlatform?.campaigns || [])[0]?.id || "campaignId";

      const updateTransport = spec.flows?.update?.transport || "api";
      const optinTransport = spec.flows?.optin?.transport || "api";

      return `%% Architecture (Mermaid)
flowchart LR
  A[Activation / Canaux<br/>Email · Web · QR · SMS]
  W[${spec.walletPlatform?.vendor || "Wallet Platform"}<br/>${accountId}.${spec.walletPlatform?.baseDomain || ""}]
  S[Source System<br/>${spec.interfaces?.sourceSystem?.name || ""}]
  D[Device client<br/>Apple Wallet / Google Wallet]

  A -->|Entrypoint URL<br/>/${projectId}/${campaignId}| W
  W -->|Install / Display| D
  W -->|GetCustomer (API)| S
  W -->|Opt-in (${optinTransport.toUpperCase()})| S
  S -->|Update (${updateTransport.toUpperCase()})| W
  S -->|Merge/Anonymize| W
`;
    },

    renderOpenApiYaml(spec, snippetOnly=false) {
      const accountId = spec.walletPlatform?.accountId || "accountId";
      const projectId = spec.walletPlatform?.projectId || "projectId";
      const apiBase = spec.interfaces?.captainWalletApi?.env?.prod?.apiBaseUrl || "https://api.captainwallet.com";

      const yaml = `openapi: 3.0.3
info:
  title: Wallet integration - ${spec.project?.name || ""}
  version: 0.1.0
servers:
  - url: ${apiBase}
paths:
  /oauth/token:
    post:
      summary: OAuth token (Captain Wallet)
      requestBody:
        required: true
        content:
          application/x-www-form-urlencoded:
            schema:
              type: object
              properties:
                client_id: { type: string }
                client_secret: { type: string }
                grant_type: { type: string, example: client_credentials }
                scope: { type: string, example: "${spec.interfaces?.captainWalletApi?.oauth?.scope || ""}" }
      responses:
        "200": { description: Token }
  /v1/${accountId}/${projectId}/pass-owners/{identifier}:
    put:
      summary: Update pass owner (standard)
      parameters:
        - name: identifier
          in: path
          required: true
          schema: { type: string }
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                metadatas:
                  type: object
                  additionalProperties: true
      responses:
        "200": { description: Updated }
  /v1/${accountId}/${projectId}/hooks/update:
    post:
      summary: Update pass owner (webhook mode)
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                identifier: { type: string }
                metadatas: { type: object, additionalProperties: true }
      responses:
        "200": { description: OK }
  /v1/${accountId}/${projectId}/delete-pass-owners:
    post:
      summary: Anonymize / delete pass owners
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                identifiers:
                  type: array
                  items: { type: string }
                campaign:
                  type: string
      responses:
        "200": { description: OK }
  /v1/${accountId}/${projectId}/hooks/merge:
    post:
      summary: Merge identifiers
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: array
              items:
                type: object
                properties:
                  IDENTIFIER_SRC: { type: string }
                  IDENTIFIER_DEST: { type: string }
      responses:
        "200": { description: OK }
`;
      if (!snippetOnly) return yaml;

      // small excerpt for the UI tab
      return yaml.split("\n").slice(0, 60).join("\n") + "\n...";
    },

    // Persistence
    persist() {
      const payload = {
        currentStep: this.currentStep,
        activeTab: this.activeTab,
        ui: { viewMode: this.ui.viewMode, logTab: this.ui.logTab }, // do not persist modal state
        project: this.project,
        journey: this.journey,
        walletPlatform: this.walletPlatform,
        entrypoint: this.entrypoint,
        security: this.security,
        dataContract: this.dataContract,
        flows: this.flows,
        interfaces: this.interfaces,
        notifications: this.notifications,
        errors: this.errors,
        testing: this.testing,
        workshopLog: this.workshopLog
      };
      localStorage.setItem("wallet_workshop_studio_v2", JSON.stringify(payload));
    },

    restore() {
      const raw = localStorage.getItem("wallet_workshop_studio_v2");
      if (!raw) return;
      const saved = safeJsonParse(raw, null);
      if (!saved) return;

      const assign = (key) => { if (saved[key] !== undefined) this[key] = saved[key]; };
      assign("currentStep");
      assign("activeTab");
      if (saved.ui && saved.ui.viewMode) this.ui.viewMode = saved.ui.viewMode;
      if (saved.ui && saved.ui.logTab) this.ui.logTab = saved.ui.logTab;

      assign("project");
      assign("journey");
      assign("walletPlatform");
      assign("entrypoint");
      assign("security");
      assign("dataContract");
      assign("flows");
      assign("interfaces");
      assign("notifications");
      assign("errors");
      assign("testing");
      assign("workshopLog");
    },

    resetAll() {
      localStorage.removeItem("wallet_workshop_studio_v2");
      location.hash = "";
      location.reload();
    },
  }
}).mount("#app");
