// Simple rules-based classifier to segment prospects and score interest
// Exports: classifyProspect(prospect)

function normalize(text) {
  return (text || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function hasAny(text, kws) {
  const t = normalize(text);
  return kws.some(k => t.includes(normalize(k)));
}

const COMPANY_SUFFIXES = [
  ' s.a', ' s.a.', ' sa ', ' srl', ' s.r.l', ' sas ', ' s.a.s', ' sl ', ' s.l.', ' ltda', ' ltd.', ' inc', ' llc', ' corp', ' gmbh', ' spa ', ' s.a.c', ' s.a. de c.v', ' c.a', ' eirl'
];

const COMPETITOR_KWS = [
  'web','diseño','digital','ingenier','leads','pauta','publicidad','online','agencia','agency',
  'marketing','seo','sem','ads','performance','growth','software','desarrollo','dev','it'
];

const PROF_KWS = {
  abogado: ['abogado','abogada','abog.','estudio jurídico','bufete','jurídic'],
  contador: ['contador','contable','cpa','estudio contable'],
  coach: ['coach','coaching','mentor','mentoring'],
  psicologo: ['psicolog','psicoterap','terapeuta','psico']
};

// Extensiones de profesiones
try { PROF_KWS.arquitecto = ['arquitecto','arquitecta','arq.']; } catch {}
try { PROF_KWS.interiorista = ['diseno de interiores','interiorismo','interiorista','decoracion','decorador','decoradora']; } catch {}

const INDUSTRY_KWS = {
  legal: ['abogado','bufete','jurídic','estudio juríd'],
  contable: ['contador','contable','estudio contable'],
  coaching: ['coach','coaching','mentoring'],
  salud: ['clinica','clínica','centro médico','psicolog','terapia','salud','odontolog'],
  agencia: ['agencia','marketing','publicidad','seo','sem','social media','growth','performance','diseño'],
  tecnologia: ['software','it','dev','sistemas','tecnolog','programación','saas'],
  construccion: ['ingenier','arquitect','obra','construcc','inmobiliaria','desarrolladora'],
  gastronomia: ['restaurante','cafeter','bar','gastronom','delivery'],
  retail: ['tienda','comercio','mayorista','minorista','retail'],
  educacion: ['colegio','universidad','instituto','academia','educac']
};

// Extensiones de rubros y sinonimos adicionales
INDUSTRY_KWS.psicologia = ['psicolog','psicoterap','terapia','salud mental'];
INDUSTRY_KWS.diseno_interiores = ['diseno de interiores','interiorismo','interiorista','decoracion','decorador','decoradora'];
INDUSTRY_KWS.arquitectura = ['arquitecto','arquitecta','estudio de arquitectura','arq.'];
INDUSTRY_KWS.constructoras = ['constructora','constructores','obra','construcc','desarrolladora'];
INDUSTRY_KWS.emprendimiento = ['emprendedor','emprendedora','emprendimiento','startup','pyme','negocio'];
INDUSTRY_KWS.locales = ['local','comercio','almacen','kiosco','ferreter','panader','verduler','libreria','perfumeria','farmacia','minimarket','bazar'];
INDUSTRY_KWS.indumentaria = ['ropa','indumentaria','boutique','showroom','moda','remeras','jeans','vestidos','zapat','calzado','accesorios','tienda de ropa'];
// sinonimos para entradas existentes con tildes mal codificadas
try { INDUSTRY_KWS.legal.push('juridic','estudio juridico'); } catch {}
try { INDUSTRY_KWS.agencia.push('diseno'); } catch {}
try { INDUSTRY_KWS.tecnologia.push('programacion'); } catch {}
try { INDUSTRY_KWS.salud.push('clinica','centro medico'); } catch {}

const TITLES_HINT_PERSON = ['sr ','sra ','srta ','dr ','dra ','lic ','ing '];
const HINT_PERSON_WORDS = ['soy ', 'mi ', 'freelance', 'independiente', 'profesional', 'trabajo por mi cuenta'];
const HINT_BUSINESS_WORDS = [
  'estudio ', 'agencia', 'empresa', 'oficial', 'store', 'tienda', 'brand', 'consultora', 'consulting', 'servicios', 'service',
  'arquitectos', 'constructora', 'srl', 's.a', 'sas', 'ltda', 'ltd', 'corp', 'llc'
];

function detectEntityKind({ name, email, domain, bio }) {
  const t = normalize([name, bio].filter(Boolean).join(' '));
  const hasCompanySuffix = COMPANY_SUFFIXES.some(s => t.includes(s));
  const hasTitle = TITLES_HINT_PERSON.some(s => t.startsWith(s) || t.includes(' ' + s));
  const emailIsFree = /@(gmail|hotmail|outlook|yahoo)\./i.test(email || '');
  const domainLooksCompany = domain && !/(gmail|hotmail|outlook|yahoo)\./i.test(domain);
  const looksLikeFullname = /^[A-Za-zÁÉÍÓÚáéíóúñÑ]+\s+[A-Za-zÁÉÍÓÚáéíóúñÑ]+$/.test((name || '').trim());

  let score = 0;
  if (hasCompanySuffix) score -= 2;
  if (hasTitle) score += 1;
  if (emailIsFree) score += 1;
  if (domainLooksCompany) score -= 1;
  if (looksLikeFullname) score += 2;
  if (HINT_PERSON_WORDS.some(w => t.includes(w))) score += 1;
  if (HINT_BUSINESS_WORDS.some(w => t.includes(w))) score -= 2;

  return score >= 1 ? 'person' : 'business';
}

function detectPersonProfession({ name, bio, headline }) {
  const text = [name, bio, headline].filter(Boolean).join(' ');
  const res = [];
  for (const [prof, kws] of Object.entries(PROF_KWS)) {
    if (hasAny(text, kws)) res.push(prof);
  }
  return res[0] || null;
}

function detectIndustry({ name, description }) {
  const text = [name, description].filter(Boolean).join(' ');
  let best = null, bestHits = 0;
  for (const [ind, kws] of Object.entries(INDUSTRY_KWS)) {
    const hits = kws.reduce((acc, kw) => acc + (hasAny(text, [kw]) ? 1 : 0), 0);
    if (hits > bestHits) { bestHits = hits; best = ind; }
  }
  return best || 'otros';
}

function isCompetitor({ name, description }) {
  const text = [name, description].filter(Boolean).join(' ');
  return hasAny(text, COMPETITOR_KWS);
}

function computeScore({ entity_kind, person_profession, industry, competitor, role, intentSignals = 0, recencyDays = 30 }) {
  let score = 0;
  // Fit
  const preferredIndustries = ['legal','contable','coaching','salud','retail','construccion','inmobiliario','gastronomia'];
  if (preferredIndustries.includes(industry)) score += 30; else score += 10;
  if (entity_kind === 'person' && person_profession) score += 10;

  // Rol/autoridad
  if (role && /owner|founder|director|ceo|dueñ|socio|independiente/i.test(role)) score += 15;

  // Intención
  score += Math.min(30, intentSignals);

  // Recencia (simple)
  if (recencyDays <= 7) score += 10;
  else if (recencyDays <= 30) score += 5;

  // Competidor
  if (competitor) score -= 60;

  // Clamp y prob
  score = Math.max(0, Math.min(100, score));
  const raw = (score - 50) / 10;
  const prob = 1 / (1 + Math.exp(-raw));

  return { score, prob };
}

function classifyProspect(p) {
  const name = p.full_name || p.username || '';
  const description = '';
  const role = '';
  const bio = '';
  const email = '';
  const domain = '';
  const last_seen_days = 30;

  const entity_kind = detectEntityKind({ name, email, domain, bio });
  const person_profession = entity_kind === 'person' ? detectPersonProfession({ name, bio, headline: role }) : null;
  const industry = detectIndustry({ name, description });
  const competitor = isCompetitor({ name, description });

  const intentSignals = 0;

  const { score, prob } = computeScore({
    entity_kind, person_profession, industry, competitor, role, intentSignals, recencyDays: last_seen_days
  });

  return {
    entity_kind,
    person_profession,
    industry,
    is_competitor: competitor ? 1 : 0,
    lead_score: score,
    interest_probability: Number(prob.toFixed(3)),
    classification_signals: {
      reasons: {
        entity: entity_kind,
        profession: person_profession,
        industry,
        competitor: competitor ? 'keywords' : 'none',
        role_hint: role || null,
        intent: intentSignals
      }
    },
    classification_version: 'rules-v1'
  };
}

module.exports = { classifyProspect };
