// api/hooporia-chat.js — Vercel Serverless Function
// Hooporia AI Agent with live Supabase player data

const SB_URL = 'https://rhsszirtbyvalugmbecm.supabase.co';
const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJoc3N6aXJ0Ynl2YWx1Z21iZWNtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ3Mjg3MzUsImV4cCI6MjA5MDMwNDczNX0.MK3sYXhbdVtijzAkXJXvMlF1t0xfk6bRumBnovbQkRs';

const POSITIONS = ['PG', 'SG', 'SF', 'PF', 'C', 'G', 'F'];
const DRILLS = ['react', 'recall', 'reflex', 'replay', 'ritmo', 'beat'];
const SCOUT_KEYWORDS = ['player', 'players', 'scout', 'scouting', 'roster', 'who', 'top', 'best', 'rank', 'leaderboard', 'class of', 'grad', 'position', 'point guard', 'shooting guard', 'small forward', 'power forward', 'center', 'jugador', 'jugadores', 'scout', 'mejor', 'mejores', 'clasificación', 'clase de', 'posición', 'base', 'escolta', 'alero', 'ala-pivot', 'pívot', 'profile', 'perfil', 'bpm score', 'level', 'nivel', 'how is', 'show me', 'find', 'search', 'muéstrame', 'buscar', 'tell me about', 'cuéntame'];

const LEVEL_LABELS = {1:'Rookie',2:'Developing',3:'Solid',4:'Advanced',5:'Elite',6:'Pro',7:'All-Star',8:'MVP',9:'Hall of Fame',10:'GOAT'};

async function sbQuery(table, params = '') {
  const url = `${SB_URL}/rest/v1/${table}?${params}`;
  const res = await fetch(url, {
    headers: {
      'apikey': SB_KEY,
      'Authorization': `Bearer ${SB_KEY}`,
      'Content-Type': 'application/json'
    }
  });
  if (!res.ok) return [];
  return res.json();
}

function needsPlayerData(messages) {
  const lastMsg = messages[messages.length - 1];
  if (!lastMsg || lastMsg.role !== 'user') return false;
  const text = lastMsg.content.toLowerCase();
  return SCOUT_KEYWORDS.some(k => text.includes(k)) ||
    POSITIONS.some(p => text.includes(p.toLowerCase())) ||
    DRILLS.some(d => text.includes(d));
}

function extractFilters(text) {
  text = text.toLowerCase();
  const filters = {};

  // Position
  const posMap = {
    'point guard': 'PG', 'pg': 'PG', 'base': 'PG',
    'shooting guard': 'SG', 'sg': 'SG', 'escolta': 'SG',
    'small forward': 'SF', 'sf': 'SF', 'alero': 'SF',
    'power forward': 'PF', 'pf': 'PF', 'ala-pivot': 'PF', 'ala pivot': 'PF',
    'center': 'C', 'pívot': 'C', 'pivot': 'C',
    'guard': 'G', 'forward': 'F'
  };
  for (const [key, val] of Object.entries(posMap)) {
    if (text.includes(key)) { filters.position = val; break; }
  }

  // Grad year
  const gradMatch = text.match(/(?:class of |clase de |grad(?:uation)?\s*(?:year)?\s*|20)(2[4-9]|3[0-2])/);
  if (gradMatch) {
    let yr = parseInt(gradMatch[1]);
    if (yr < 100) yr += 2000;
    filters.grad_year = yr;
  }

  // Drill
  for (const d of DRILLS) {
    if (text.includes(d)) { filters.drill = d; break; }
  }

  // Speed
  if (text.includes('elite') || text.includes('120') || text.includes('fast')) filters.speed = 'fast';
  else if (text.includes('tempo') || text.includes('90') || text.includes('med')) filters.speed = 'med';
  else if (text.includes('training') || text.includes('60') || text.includes('slow')) filters.speed = 'slow';

  // Player name search
  const namePatterns = [
    /(?:about|find|show me|tell me about|how is|cuéntame sobre|muéstrame a|buscar a|cómo está)\s+([a-záéíóúñ]+ [a-záéíóúñ]+)/i,
    /(?:about|find|show me|tell me about|how is|cuéntame sobre|muéstrame a|buscar a|cómo está)\s+([a-záéíóúñ]+)/i
  ];
  for (const pat of namePatterns) {
    const m = text.match(pat);
    if (m) {
      const name = m[1].trim();
      // Filter out generic words
      const skip = ['the', 'top', 'best', 'all', 'any', 'your', 'our', 'some', 'players', 'jugadores', 'drills', 'report', 'premium', 'free'];
      if (!skip.includes(name.toLowerCase())) {
        filters.name = name;
        break;
      }
    }
  }

  // Top N
  const topMatch = text.match(/top\s*(\d+)/);
  filters.limit = topMatch ? Math.min(parseInt(topMatch[1]), 20) : 10;

  return filters;
}

async function fetchPlayerData(filters) {
  let context = '';

  // Fetch all players
  let playerParams = 'select=id,first_name,last_name,slug,position,grad_year,school,jersey_number,height,city,state&order=last_name.asc';
  if (filters.position) playerParams += `&position=eq.${filters.position}`;
  if (filters.grad_year) playerParams += `&grad_year=eq.${filters.grad_year}`;

  let players = await sbQuery('players', playerParams);

  // Name search
  if (filters.name) {
    const search = filters.name.toLowerCase();
    const nameWords = search.split(' ');
    players = players.filter(p => {
      const full = `${p.first_name} ${p.last_name}`.toLowerCase();
      return nameWords.every(w => full.includes(w)) || 
        p.first_name.toLowerCase().includes(search) ||
        p.last_name.toLowerCase().includes(search);
    });
  }

  if (!players.length) {
    return filters.name 
      ? `\n[DATABASE SEARCH: No player found matching "${filters.name}". There are currently no matches in the database for that name.]`
      : `\n[DATABASE SEARCH: No players found matching those filters.]`;
  }

  // Fetch scores for matched players
  const playerIds = players.map(p => p.id);
  let scoreParams = `select=*&player_id=in.(${playerIds.join(',')})`;
  if (filters.drill) scoreParams += `&test_name=eq.${filters.drill}`;
  if (filters.speed) scoreParams += `&speed=eq.${filters.speed}`;

  const scores = await sbQuery('cognitive_scores', scoreParams);

  // Build player score map
  const scoreMap = {};
  scores.forEach(s => {
    if (!scoreMap[s.player_id]) scoreMap[s.player_id] = {};
    if (!scoreMap[s.player_id][s.test_name]) scoreMap[s.player_id][s.test_name] = {};
    const existing = scoreMap[s.player_id][s.test_name][s.speed];
    if (!existing || s.level > existing.level || (s.level === existing.level && s.score > existing.score)) {
      scoreMap[s.player_id][s.test_name][s.speed] = s;
    }
  });

  // Calculate rankings
  const ranked = players.map(p => {
    const pScores = scoreMap[p.id] || {};
    let totalLevel = 0, drillCount = 0, totalScore = 0;
    const drillSummary = [];

    for (const drill of DRILLS) {
      if (pScores[drill]) {
        // Get best across speeds
        let bestLevel = 0, bestScore = 0, bestSpeed = '';
        for (const [spd, data] of Object.entries(pScores[drill])) {
          if (data.level > bestLevel || (data.level === bestLevel && data.score > bestScore)) {
            bestLevel = data.level;
            bestScore = data.score;
            bestSpeed = spd;
          }
        }
        if (bestLevel > 0) {
          totalLevel += bestLevel;
          totalScore += bestScore;
          drillCount++;
          drillSummary.push(`${drill.charAt(0).toUpperCase() + drill.slice(1)}: L${bestLevel} (${bestScore}pts, ${bestSpeed === 'fast' ? 'Elite' : bestSpeed === 'med' ? 'Tempo' : 'Training'})`);
        }
      }
    }

    const avgLevel = drillCount > 0 ? (totalLevel / drillCount) : 0;
    return {
      player: p,
      avgLevel: Math.round(avgLevel * 10) / 10,
      roundedLevel: Math.round(avgLevel),
      totalScore,
      drillCount,
      drillSummary
    };
  }).filter(r => r.drillCount > 0 || filters.name);

  // Sort by level then score
  ranked.sort((a, b) => {
    if (b.roundedLevel !== a.roundedLevel) return b.roundedLevel - a.roundedLevel;
    return b.totalScore - a.totalScore;
  });

  // Limit results
  const limited = ranked.slice(0, filters.limit);

  if (!limited.length) {
    return `\n[DATABASE: Found ${players.length} player(s) but none have BPM scores yet.]`;
  }

  // Build context string
  context = `\n[LIVE DATABASE — ${limited.length} player(s) found]\n`;

  limited.forEach((r, i) => {
    const p = r.player;
    const label = LEVEL_LABELS[r.roundedLevel] || '';
    context += `\n#${i + 1} ${p.first_name} ${p.last_name}`;
    context += ` | ${p.position || 'N/A'} | ${p.school || 'N/A'}`;
    if (p.grad_year) context += ` | Class of ${p.grad_year}`;
    if (p.height) context += ` | ${p.height}`;
    if (p.city || p.state) context += ` | ${[p.city, p.state].filter(Boolean).join(', ')}`;
    context += ` | Jersey #${p.jersey_number || 'N/A'}`;
    context += `\n  Overall BPM: L${r.roundedLevel} ${label} | Total Score: ${r.totalScore} | Drills Played: ${r.drillCount}/6`;
    if (r.drillSummary.length) context += `\n  Drill Breakdown: ${r.drillSummary.join(' | ')}`;
    context += `\n  Profile: hooporia.com/player/${p.slug}`;
    context += '\n';
  });

  if (ranked.length > limited.length) {
    context += `\n[${ranked.length - limited.length} more players not shown. User can ask to see more.]`;
  }

  return context;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const { messages } = req.body;
  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'messages array required' });
  }

  // Check if we need player data
  let playerContext = '';
  if (needsPlayerData(messages)) {
    try {
      const filters = extractFilters(messages[messages.length - 1].content);
      playerContext = await fetchPlayerData(filters);
    } catch (err) {
      console.error('Supabase query error:', err);
      playerContext = '\n[DATABASE: Error fetching player data. Respond based on general knowledge only.]';
    }
  }

  const SYSTEM_PROMPT = `You are the Hooporia AI — the official expert for Hooporia™, a basketball cognitive training platform powered by BPM Basketball™. You are friendly, confident, bilingual (English/Spanish), and speak like a knowledgeable basketball scout who understands both the game and the data.

CRITICAL RULES:
- Respond in the same language the user writes in
- Keep responses SHORT — 2-4 sentences for simple questions, up to 6-8 for player breakdowns
- Be conversational, not corporate. You're a scout with a database, not a FAQ page
- Use basketball language naturally
- When presenting player data, be specific with numbers and levels
- Always include the player's profile link when discussing a specific player
- If no player data is found, say so clearly and suggest they try different search terms
- Never make up player data — only use what's in the [DATABASE] context
- If asked about a player not in the database, say they may not have created a profile yet and suggest hooporia.com/join.html

ABOUT HOOPORIA:
Hooporia™ is the platform. BPM Basketball™ is the proprietary cognitive training system. Owned by GoStar Digital LLC, San Juan, Puerto Rico. Website: hooporia.com

THE 6 COGNITIVE DRILLS:
1. THE REACT (purple) — Rhythm reaction. Watch pattern flash 3x, tap cells on the beat. Tests reaction time and rhythm processing.
2. THE RECALL (orange) — Number recall. Memorize numbered cells, tap back in order. Tests working memory.
3. THE REFLEX (cyan) — Flash memory. Multiple cells flash at once, find them all. Tests visual memory and spatial awareness.
4. THE REPLAY (teal) — Sequence replay. Watch sequence, replay exact order. Tests sequential memory. PREMIUM.
5. THE RITMO (lime) — Spot the change. Find the one cell that changed. Tests change detection. PREMIUM.
6. THE BEAT (gold) — Rhythm training with Latin beats: Reggaeton, Bomba, Plena, Salsa, Clave, Merengue. PREMIUM.

BPM SYSTEM:
- 3 speeds: Training (60 BPM), Tempo (90 BPM), Elite (120 BPM)
- 10 levels: L1 Rookie → L10 GOAT
- BPM = Beats Per Minute (rhythm-based training) AND Box Plus/Minus (basketball analytics)

LEVEL RATINGS: L1 Rookie, L2 Developing, L3 Solid, L4 Advanced, L5 Elite, L6 Pro, L7 All-Star, L8 MVP, L9 Hall of Fame, L10 GOAT

FREE VS PREMIUM:
- FREE: React, Recall, Reflex, player profile, Discover database, basic BPM scores
- PREMIUM ($49/year or $7/month): All 6 drills + AI Scouting Report + full BPM profile + basketball timeline
- IMPORTANT: Use same email for signup and payment

SCOUTING REPORT:
- AI-generated professional report analyzing all 6 drills
- Includes strengths, development areas, on-court translation, recommendations
- Personalized to position, play style, competition level
- Share with any coach, scout, or program

FOR PROGRAMS: Cost $0. Share hooporia.com, players sign up free, coaches track BPM levels.

WHEN DISCUSSING PLAYERS:
- Present data professionally, like a real scouting report
- Highlight strengths (highest drill levels) and areas to develop (lowest)
- Translate BPM scores to basketball: high React = quick decisions, high Recall = play memorization, high Reflex = court vision, high Replay = play sequencing, high Ritmo = reading changes in defense
- Always mention their profile link
- If comparing players, be fair and data-driven
- If a player has no scores yet, encourage them to run the drills

PERSONALITY:
- You're a basketball scout with AI power
- Excited about talent, data-driven, fair
- Puerto Rico pride — built in PR
- Bilingual — match the user's language
- If someone asks something outside basketball/Hooporia, redirect politely`;

  // Build messages with player context injected
  const apiMessages = messages.slice(-10).map((m, i, arr) => {
    if (i === arr.length - 1 && m.role === 'user' && playerContext) {
      return { role: 'user', content: m.content + playerContext };
    }
    return m;
  });

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 800,
        system: SYSTEM_PROMPT,
        messages: apiMessages
      })
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('Anthropic error:', err);
      return res.status(500).json({ error: 'AI service error' });
    }

    const data = await response.json();
    const text = data.content && data.content[0] ? data.content[0].text : '';
    return res.status(200).json({ reply: text });

  } catch (err) {
    console.error('Chat error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
}
