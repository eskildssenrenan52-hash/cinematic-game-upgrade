// @ts-nocheck — imported game code, typed under the original looser tsconfig
import { BiomeId, BossEntityKind, PlayModeId } from './types';

export interface PlayModeDef {
  id: PlayModeId;
  name: string;
  tagline: string;
  description: string;
  rules: string[];
  accentColor: string;
  badge: string;
  difficulty: string;
}

export const PLAY_MODES: PlayModeDef[] = [
  {
    id: 'campaign',
    name: 'Campanha Épica',
    tagline: '20 Fases · 200 Etapas · 20 Chefões',
    description:
      'A jornada completa por Aethelgard com diálogos, cutscenes únicas em cada fase, fogueiras, relíquias secretas, gancho aéreo e um chefão multi-fase na última sala de cada capítulo.',
    rules: [
      'Progressão por 20 biomas completos (200 etapas interligadas)',
      'Cutscenes únicas de abertura e confronto de chefe em cada fase',
      'Santuário de Runas, Espíritos Orbitais, Dupla [F] e Árvore de Maestria',
    ],
    accentColor: '#ffd27d',
    badge: 'HISTÓRIA',
    difficulty: 'Padrão',
  },
  {
    id: 'boss_rush',
    name: 'Rush dos Chefões',
    tagline: '20 Arenas Diretas · Duelo Supremo',
    description:
      'Enfrente todos os 20 Chefões multi-fase em sequência implacável! Cada chefe recua taticamente ao sofrer dano, exigindo perseguição, parry e reação elemental.',
    rules: [
      'Teleporte imediato entre as 20 arenas finais de chefões',
      'Escudo do herói e cargas recarregadas a cada vitória',
      'Cronômetro dedicado de Boss Rush e bônus de Moedas Astrais',
    ],
    accentColor: '#ff4d7d',
    badge: 'CHEFÕES 1-20',
    difficulty: 'Muito Alta',
  },
  {
    id: 'survival',
    name: 'Arena Infinita',
    tagline: 'Ondas Crescentes & Mini-Chefes',
    description:
      'Resista na Arena do Coliseu contra ondas infinitas de monstros e chefes invasores! Acumule combos, dispare reações elementais e alcance ondas lendárias.',
    rules: [
      'Ondas progressivas com inimigos terrestres, aéreos e chefes a cada 3 ondas',
      'Derrotar inimigos libera Moedas Astrais e carga dupla de Éter Supremo',
      'Recorde salvo pela maior onda e maior pontuação de estilo',
    ],
    accentColor: '#4df0c0',
    badge: 'ARCADE ONDAS',
    difficulty: 'Crescente',
  },
  {
    id: 'speedrun',
    name: 'Modo Speedrun',
    tagline: 'Cronômetro & Fantasma Replay · Zero Cortes',
    description:
      'Feito para quebrar recordes! Pula cutscenes automáticas, inicia com todas as 20 fases liberadas e projeta seu Fantasma de Replay em tempo real!',
    rules: [
      'Todas as 20 fases desbloqueadas para treino e rotas livres',
      'Fantasma de Replay mostra sua melhor corrida etapa por etapa',
      'Metas de medalha Ouro, Prata e Bronze exibidas no HUD',
    ],
    accentColor: '#52e5ff',
    badge: 'CONTRA O RELÓGIO',
    difficulty: 'Competitiva',
  },
  {
    id: 'glass_cannon',
    name: 'Fúria Etérea',
    tagline: '1 Vida por Etapa · Poder 2x',
    description:
      'Adrenalina pura: sobreviva sem errar enquanto sua energia de Éter Supremo carrega 2.5x mais rápido, suas habilidades recarregam velozmente e o placar triplica!',
    rules: [
      'Tensão máxima estilo Ironman com recarga de habilidade 40% mais rápida',
      'Carga de Éter Supremo 2.5x acelerada + velocidade ampliada',
      '3x Pontos de Estilo e +2 Moedas Astrais extras por abate',
    ],
    accentColor: '#ff7733',
    badge: 'RISCO & PODER',
    difficulty: 'Extrema',
  },
  {
    id: 'tower',
    name: 'Torre Infinita',
    tagline: 'Escalada Vertical · Boss a cada 5 Andares',
    description:
      'Suba câmaras verticais procedurais com cipós, molas, plataformas móveis e espinhos. Derrote um Guardião Boss a cada 5 andares para conquistar moedas, XP e Cartas Astrais!',
    rules: [
      'Câmaras verticais altas (42×48) com biomas alternados e cipós aéreos',
      'Escudo regenera a cada andar · Boss Guardião a cada 5 andares',
      '+Moedas Astrais, +XP de Nível e Carta Astral por andar de chefe',
    ],
    accentColor: '#38bdf8',
    badge: 'TORRE VERTICAL',
    difficulty: 'Crescente',
  },
  {
    id: 'mirror_void',
    name: 'Caos Sideral',
    tagline: 'Baixa Gravidade · Dash Duplo · Ventania',
    description:
      'A montanha sofre uma anomalia cósmica! Ganhe +1 Dash extra no ar e gravidade lunar em todas as etapas, enquanto ventos, climas e inimigos aceleram o ritmo.',
    rules: [
      '+1 Carga de Dash permanente no ar e gravidade reduzida em 28%',
      'Inimigos e armadilhas com velocidade +25% e clima intenso',
      'Todas as 20 fases acessíveis + dobro de Moedas Astrais',
    ],
    accentColor: '#d580ff',
    badge: 'ANOMALIA',
    difficulty: 'Caótica',
  },
];

export const PLAY_MODE_MAP: Record<PlayModeId, PlayModeDef> = Object.fromEntries(
  PLAY_MODES.map((m) => [m.id, m])
) as Record<PlayModeId, PlayModeDef>;

export function getPlayModeDef(id: PlayModeId | string | undefined): PlayModeDef {
  if (id && id in PLAY_MODE_MAP) return PLAY_MODE_MAP[id as PlayModeId];
  return PLAY_MODE_MAP.campaign;
}

export interface BossMetaDef {
  kind: BossEntityKind;
  chapterIndex: number;
  biome: BiomeId;
  name: string;
  title: string;
  maxHp: number;
  accentColor: string;
  secondaryColor: string;
  patternsLabel: string;
}

export const BOSS_META: Record<BossEntityKind, BossMetaDef> = {
  boss_sentinel: {
    kind: 'boss_sentinel',
    chapterIndex: 0,
    biome: 'silver_ash',
    name: 'GUARDIÃO DAS CINZAS',
    title: 'Colosso Rúnico da Vigília',
    maxHp: 6,
    accentColor: '#e8a87c',
    secondaryColor: '#ffd27d',
    patternsLabel: 'Salto Sísmico · Investida Blindada · Recuo Tático',
  },
  boss_mycelium: {
    kind: 'boss_mycelium',
    chapterIndex: 1,
    biome: 'bioluminescent',
    name: 'RAINHA DO MICÉLIO',
    title: 'Leviatã Bioluminescente',
    maxHp: 7,
    accentColor: '#4df0c0',
    secondaryColor: '#a7f3d0',
    patternsLabel: 'Morteiro de Esporos · Erupção de Raízes · Recuo Espectral',
  },
  boss_glacier: {
    kind: 'boss_glacier',
    chapterIndex: 2,
    biome: 'frostglass',
    name: 'ARCONTE GLACIAL',
    title: 'Serafim da Cidadela Safira',
    maxHp: 7,
    accentColor: '#7ce8ff',
    secondaryColor: '#ffffff',
    patternsLabel: 'Feixe Criogênico · Chuva de Estalactites · Nevasca',
  },
  boss_ignis_rex: {
    kind: 'boss_ignis_rex',
    chapterIndex: 3,
    biome: 'obsidian_forge',
    name: 'TITÃ DA OBSIDIANA',
    title: 'Senhor Supremo da Fornalha',
    maxHp: 8,
    accentColor: '#ff7733',
    secondaryColor: '#ffe066',
    patternsLabel: 'Erupção de Magma · Roda Solar · Chuva Meteórica',
  },
  boss_astral_oracle: {
    kind: 'boss_astral_oracle',
    chapterIndex: 4,
    biome: 'astral_void',
    name: 'ORÁCULO DO VAZIO',
    title: 'Entidade Cósmica Bifacial',
    maxHp: 8,
    accentColor: '#d580ff',
    secondaryColor: '#52e5ff',
    patternsLabel: 'Cruz Dimensional · Centelhas Perseguidoras · Singularidade',
  },
  boss_sakura: {
    kind: 'boss_sakura',
    chapterIndex: 5,
    biome: 'crimson_sakura',
    name: 'KITSUNE CARMESIM',
    title: 'Espírito das Nove Pétalas',
    maxHp: 8,
    accentColor: '#ff5e8e',
    secondaryColor: '#ffd27d',
    patternsLabel: 'Lâmina Carmesim · Salto Fantasma · Tempestade de Flores',
  },
  boss_leviathan: {
    kind: 'boss_leviathan',
    chapterIndex: 6,
    biome: 'sunken_cathedral',
    name: 'LEVIATÃ DO ABISMO',
    title: 'Guardião da Catedral Submersa',
    maxHp: 9,
    accentColor: '#22d3ee',
    secondaryColor: '#5eead4',
    patternsLabel: 'Raio Abissal · Maré de Pérolas · Maremoto Sônico',
  },
  boss_chronos: {
    kind: 'boss_chronos',
    chapterIndex: 7,
    biome: 'clockwork_spire',
    name: 'SENTINELA CRONOS',
    title: 'Arquiteto das Engrenagens Solares',
    maxHp: 9,
    accentColor: '#f59e0b',
    secondaryColor: '#fde68a',
    patternsLabel: 'Pêndulo Cortante · Engrenagens Solares · Paradoxo Temporal',
  },
  boss_seraph_king: {
    kind: 'boss_seraph_king',
    chapterIndex: 8,
    biome: 'emerald_sky',
    name: 'SERAFIM ESMERALDA',
    title: 'Regente dos Jardins Celestes',
    maxHp: 9,
    accentColor: '#34d399',
    secondaryColor: '#fef08a',
    patternsLabel: 'Glória Solar · Chuva Celeste · Espiral Divina',
  },
  boss_sphinx: {
    kind: 'boss_sphinx',
    chapterIndex: 9,
    biome: 'solar_mirage',
    name: 'ESFINGE DE ÔNIX',
    title: 'Guardiã das Dunas Solares',
    maxHp: 9,
    accentColor: '#fbbf24',
    secondaryColor: '#f97316',
    patternsLabel: 'Raio do Sol · Tempestade de Areia · Obeliscos Caídos',
  },
  boss_lich: {
    kind: 'boss_lich',
    chapterIndex: 10,
    biome: 'amethyst_crypt',
    name: 'ARQUILICH AMETISTA',
    title: 'Soberano da Necrópole Espectral',
    maxHp: 10,
    accentColor: '#c084fc',
    secondaryColor: '#5eead4',
    patternsLabel: 'Ceifa Espectral · Crânios Perseguidores · Ritual Abissal',
  },
  boss_automaton: {
    kind: 'boss_automaton',
    chapterIndex: 11,
    biome: 'alchemical_labs',
    name: 'AUTÔMATO ALQUÍMICO',
    title: 'Colosso de Mercúrio & Plasma',
    maxHp: 10,
    accentColor: '#2dd4bf',
    secondaryColor: '#f43f5e',
    patternsLabel: 'Bombas Ácidas · Grade Tesla · Sobrecarga Prismática',
  },
  boss_valkyrie: {
    kind: 'boss_valkyrie',
    chapterIndex: 12,
    biome: 'aurora_zenith',
    name: 'VALQUÍRIA BOREAL',
    title: 'Lâmina da Aurora Eterna',
    maxHp: 10,
    accentColor: '#67e8f9',
    secondaryColor: '#e879f9',
    patternsLabel: 'Mergulho Aurora · Lanças Prismáticas · Juízo Boreal',
  },
  boss_canyon_colossus: {
    kind: 'boss_canyon_colossus',
    chapterIndex: 13,
    biome: 'crimson_canyon',
    name: 'COLOSSO DO CÂNION',
    title: 'Titã Escarlate de Basalto',
    maxHp: 10,
    accentColor: '#fb7185',
    secondaryColor: '#fcd34d',
    patternsLabel: 'Terremoto Rubro · Chuva de Rocha · Onda Tectônica',
  },
  boss_cyber_archon: {
    kind: 'boss_cyber_archon',
    chapterIndex: 14,
    biome: 'cyber_undercity',
    name: 'ARCONTE NEON-IX',
    title: 'Núcleo Cibernético Subterrâneo',
    maxHp: 10,
    accentColor: '#22d3ee',
    secondaryColor: '#f472b6',
    patternsLabel: 'Matriz Laser · Drones de Plasma · Sobrecarga Neon',
  },
  boss_marble_titan: {
    kind: 'boss_marble_titan',
    chapterIndex: 15,
    biome: 'celestial_marble',
    name: 'COLOSSO DE MÁRMORE',
    title: 'Guardião do Partenon Celeste',
    maxHp: 11,
    accentColor: '#fde68a',
    secondaryColor: '#60a5fa',
    patternsLabel: 'Égide Dourada · Trovão Olímpico · Pilares Celestes',
  },
  boss_fen_hydra: {
    kind: 'boss_fen_hydra',
    chapterIndex: 16,
    biome: 'ebony_fen',
    name: 'HIDRA DE ÉBANO',
    title: 'Soberana do Pântano Sombrío',
    maxHp: 11,
    accentColor: '#34d399',
    secondaryColor: '#c084fc',
    patternsLabel: 'Tríplice Baforada · Salto Venenoso · Névoa Tóxica',
  },
  boss_star_emperor: {
    kind: 'boss_star_emperor',
    chapterIndex: 17,
    biome: 'orbital_nexus',
    name: 'IMPERADOR SIDERAL',
    title: 'Regente da Estação Orbital',
    maxHp: 11,
    accentColor: '#a5b4fc',
    secondaryColor: '#fbbf24',
    patternsLabel: 'Órbita Quântica · Raio de Supernova · Pulso Gravitacional',
  },
  boss_twilight_wraith: {
    kind: 'boss_twilight_wraith',
    chapterIndex: 18,
    biome: 'twilight_garden',
    name: 'ESPECTRO DO CREPÚSCULO',
    title: 'Ceifador do Jardim Violeta',
    maxHp: 11,
    accentColor: '#e879f9',
    secondaryColor: '#fb7185',
    patternsLabel: 'Lótus Sombria · Rajada Crepuscular · Véu de Espinhos',
  },
  boss_sovereign: {
    kind: 'boss_sovereign',
    chapterIndex: 19,
    biome: 'stormcrown',
    name: 'SOBERANO DOS ECOS',
    title: 'Imperador da Tempestade',
    maxHp: 12,
    accentColor: '#ff4d7d',
    secondaryColor: '#ffd27d',
    patternsLabel: 'Varredura Prismática · Juízo de Raios · Colapso do Éter',
  },
};

export const BOSS_ORDER: BossEntityKind[] = [
  'boss_sentinel',
  'boss_mycelium',
  'boss_glacier',
  'boss_ignis_rex',
  'boss_astral_oracle',
  'boss_sakura',
  'boss_leviathan',
  'boss_chronos',
  'boss_seraph_king',
  'boss_sphinx',
  'boss_lich',
  'boss_automaton',
  'boss_valkyrie',
  'boss_canyon_colossus',
  'boss_cyber_archon',
  'boss_marble_titan',
  'boss_fen_hydra',
  'boss_star_emperor',
  'boss_twilight_wraith',
  'boss_sovereign',
];

export function isBossKind(kind: string): kind is BossEntityKind {
  return kind in BOSS_META;
}
