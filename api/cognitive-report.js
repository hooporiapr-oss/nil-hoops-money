module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  var apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'API key not configured' });
  }

  var body = req.body;

  // === PLAYER PROFILE DATA ===
  var playerName = body.name || 'Player';
  var position = body.position || '';
  var age = body.age || '';
  var height = body.height || '';
  var weight = body.weight || '';
  var wingspan = body.wingspan || '';
  var dominantHand = body.dominant_hand || '';
  var playStyle = body.play_style || '';
  var competitionLevel = body.competition_level || '';
  var yearsPlaying = body.years_playing || '';

  // === TIMELINE DATA ===
  var totalSeasons = body.total_seasons || 0;
  var totalGames = body.total_games || 0;
  var totalAwards = body.total_awards || 0;
  var seasonHistory = body.season_history || ''; // formatted string of seasons

  // === COGNITIVE SCORES ===
  var scores = body.scores || {};

  var testDescriptions = {
    react: {
      name: 'THE REACT',
      dimension: 'R — React',
      measures: 'Reaction & Rhythm',
      detail: 'Measures how fast the player processes and responds to visual stimuli at game speed. Tests rhythmic timing, anticipation, and the ability to play on tempo under pressure. Higher levels indicate a player who can operate at 120 BPM game pace without mental breakdown.',
      courtImpact: 'Fast break decisions, steal anticipation, help defense rotations, shot clock awareness, clutch-moment composure'
    },
    recall: {
      name: 'THE RECALL',
      dimension: 'I — Instinct',
      measures: 'Working Memory',
      detail: 'Measures how many positions, assignments, and reads the player can hold in active memory simultaneously. Scales from 5 to 14 elements. Higher levels indicate a player who can execute complex offensive sets while tracking defensive assignments.',
      courtImpact: 'Play execution, offensive set memorization, defensive assignment recall, in-game adjustment retention, coach instruction implementation'
    },
    reflex: {
      name: 'THE REFLEX',
      dimension: 'T — Track',
      measures: 'Visual Processing / Court Vision',
      detail: 'Measures the ability to capture an entire scene in a split second — all player positions, open lanes, and spacing — in flash times as short as 0.8 seconds. This is the closest measurable analog to elite court vision.',
      courtImpact: 'Skip passes, no-look assists, drive-and-kick reads, fast break outlet vision, defensive rotations, reading the full floor in transition'
    },
    replay: {
      name: 'THE REPLAY',
      dimension: 'N — Navigate',
      measures: 'Sequence Memory / Play Recall',
      detail: 'Measures the ability to memorize and execute multi-step sequences under increasing complexity and speed. Sequences scale from 5 to 25 steps with unique audio-visual encoding. Directly correlates to play memorization and muscle memory formation.',
      courtImpact: 'Running complex offensive plays from memory, executing multi-read progressions, inbound play execution, defensive scheme memorization, film study retention'
    },
    ritmo: {
      name: 'THE RITMO',
      dimension: 'O — Observe',
      measures: 'Change Detection',
      detail: 'Measures how quickly the player spots what changed in a pattern — one element shifts, and the player must identify it within 4 beats. Patterns scale from 3 to 12 elements. This tests the ability to read defensive rotations and offensive movement in real time.',
      courtImpact: 'Reading defensive shifts, identifying the open man after a rotation, noticing backdoor cuts, pick-and-roll coverage reads, zone defense gap identification'
    },
    beat: {
      name: 'THE BEAT',
      dimension: 'ME — Meter',
      measures: 'Game Rhythm & Timing',
      detail: 'Measures internal rhythm and timing synchronization across multiple Latin-influenced musical patterns (Reggaeton, Bomba, Plena, Salsa, Clave, Merengue). Tests the player\'s ability to stay on beat under changing tempos — the cognitive foundation of flow state.',
      courtImpact: 'Dribble cadence control, pick-and-roll timing, shot rhythm consistency, transition pace management, game tempo control, clutch-moment rhythm maintenance'
    }
  };

  var ratingLabels = {
    1: 'Rookie', 2: 'Developing', 3: 'Solid', 4: 'Advanced', 5: 'Elite',
    6: 'Pro', 7: 'All-Star', 8: 'MVP', 9: 'Hall of Fame', 10: 'GOAT'
  };

  var speedLabels = {
    slow: 'Training (60 BPM)',
    med: 'Tempo (90 BPM)',
    fast: 'Elite (120 BPM)'
  };

  // Build detailed score analysis
  var scoreLines = [];
  var strengthTests = [];
  var weakTests = [];
  var totalLevel = 0;
  var testCount = 0;

  ['react', 'recall', 'reflex', 'replay', 'ritmo', 'beat'].forEach(function(test) {
    var s = scores[test];
    var desc = testDescriptions[test];
    if (s && s.level) {
      var rating = ratingLabels[s.level] || 'Level ' + s.level;
      var speed = speedLabels[s.speed] || s.speed;
      scoreLines.push(
        desc.dimension + ': ' + desc.name + ' — ' + desc.measures +
        '\n  Level: L' + s.level + ' (' + rating + ') | Speed: ' + speed + ' | Score: ' + s.score + ' pts' +
        '\n  What it measures: ' + desc.detail +
        '\n  Court impact: ' + desc.courtImpact
      );
      totalLevel += s.level;
      testCount++;
      if (s.level >= 7) strengthTests.push({ test: test, level: s.level, name: desc.name, dim: desc.dimension });
      if (s.level <= 5) weakTests.push({ test: test, level: s.level, name: desc.name, dim: desc.dimension });
    }
  });

  var overallLevel = testCount > 0 ? Math.round(totalLevel / testCount) : 0;
  var overallRating = ratingLabels[overallLevel] || 'Not Rated';

  if (scoreLines.length === 0) {
    return res.status(400).json({ error: 'No cognitive scores to analyze' });
  }

  // Build player context section
  var profileContext = 'PLAYER PROFILE:\n';
  profileContext += 'Name: ' + playerName + '\n';
  if (position) profileContext += 'Position: ' + position + '\n';
  if (age) profileContext += 'Age: ' + age + '\n';
  if (height) profileContext += 'Height: ' + height + '\n';
  if (weight) profileContext += 'Weight: ' + weight + '\n';
  if (wingspan) profileContext += 'Wingspan: ' + wingspan + '\n';
  if (dominantHand) profileContext += 'Dominant Hand: ' + dominantHand + '\n';
  if (playStyle) profileContext += 'Play Style: ' + playStyle + '\n';
  if (competitionLevel) profileContext += 'Competition Level: ' + competitionLevel + '\n';
  if (yearsPlaying) profileContext += 'Years Playing Basketball: ' + yearsPlaying + '\n';

  // Timeline context
  var timelineContext = '';
  if (totalSeasons > 0 || totalGames > 0) {
    timelineContext = '\nBASKETBALL HISTORY:\n';
    if (totalSeasons) timelineContext += 'Total Seasons: ' + totalSeasons + '\n';
    if (totalGames) timelineContext += 'Total Games Played: ' + totalGames + '\n';
    if (totalAwards) timelineContext += 'Awards/Recognitions: ' + totalAwards + '\n';
    if (seasonHistory) timelineContext += 'Season Details:\n' + seasonHistory + '\n';
  }

  // Strength/weakness summary for the prompt
  var strengthSummary = '';
  if (strengthTests.length > 0) {
    strengthSummary = '\nIDENTIFIED STRENGTHS (L7+): ' + strengthTests.map(function(s) { return s.name + ' (L' + s.level + ')'; }).join(', ');
  }
  var weakSummary = '';
  if (weakTests.length > 0) {
    weakSummary = '\nIDENTIFIED DEVELOPMENT AREAS (L5 or below): ' + weakTests.map(function(s) { return s.name + ' (L' + s.level + ')'; }).join(', ');
  }

  // === THE PROMPT ===
  var prompt = 'You are an elite basketball cognitive performance analyst for Hooporia. You write professional scouting reports using the RITNOME™ Cognitive Performance System — the only system in basketball that measures how a player thinks on the court.\n\n' +

    'RITNOME™ stands for:\n' +
    'R — React (Reaction & Rhythm)\n' +
    'I — Instinct (Working Memory)\n' +
    'T — Track (Visual Processing / Court Vision)\n' +
    'N — Navigate (Sequence Memory / Play Recall)\n' +
    'O — Observe (Change Detection)\n' +
    'ME — Meter (Game Rhythm & Timing)\n\n' +

    'Scale: L1 (Rookie) → L10 (GOAT). Each level is earned through verified drill performance — players cannot fake these scores.\n\n' +

    profileContext +
    timelineContext +
    strengthSummary +
    weakSummary + '\n\n' +

    'RITNOME™ COGNITIVE SCORES:\n' +
    'Overall: L' + overallLevel + ' (' + overallRating + ') | Tests Completed: ' + testCount + '/6\n\n' +
    scoreLines.join('\n\n') + '\n\n' +

    'GENERATE THE REPORT using these exact section headers:\n\n' +

    '🧠 COGNITIVE SCOUTING REPORT\n' +
    'Player: [name] | Position: [pos] | Overall RITNOME™: L[X] [Rating]\n' +
    (dominantHand ? 'Hand: [hand] | ' : '') +
    (playStyle ? 'Style: [style] | ' : '') +
    (competitionLevel ? 'Level: [competition] | ' : '') +
    (yearsPlaying ? 'Experience: [X] years' : '') + '\n\n' +

    '📊 EXECUTIVE SUMMARY\n' +
    '3-4 sentences. Define this player\'s cognitive identity. What kind of basketball mind are they? How do they process the game differently from average players at their competition level? Be specific to their position' + (position ? ' (' + position + ')' : '') + '.\n\n' +

    '💪 COGNITIVE STRENGTHS\n' +
    'Top 2-3 strengths. For EACH strength:\n' +
    '- Name the RITNOME™ dimension and level\n' +
    '- Translate into 2-3 specific basketball scenarios where this shows up\n' +
    '- Reference their position, ' + (dominantHand ? 'dominant hand (' + dominantHand + '), ' : '') + 'and competition level\n' +
    '- Use specific basketball language (pick-and-roll, drive-and-kick, weak-side rotation, skip pass, etc.)\n\n' +

    '⚡ AREAS FOR DEVELOPMENT\n' +
    '1-2 weakest dimensions. For EACH:\n' +
    '- Name the RITNOME™ dimension and level\n' +
    '- Explain what this means on the court (specific game situations where this shows)\n' +
    '- Give a specific training recommendation using Hooporia drills\n' +
    '- Frame constructively — development opportunity, not weakness\n\n' +

    '🏀 ON-COURT TRANSLATION\n' +
    'Break down what a coach should expect in these specific situations:\n' +
    '- Transition (offense AND defense)\n' +
    '- Half-court offense (specific to their position and play style)\n' +
    '- Defensive assignments and reads\n' +
    '- Pressure situations (close games, final minutes)\n' +
    '- Team dynamics (communication, leadership potential based on cognitive profile)\n' +
    (dominantHand ? '- How their dominant hand (' + dominantHand + ') combines with their cognitive strengths\n' : '') +
    '\n' +

    '🎯 COACH RECOMMENDATION\n' +
    '3-4 specific, actionable recommendations:\n' +
    '- Offensive role and responsibilities\n' +
    '- Defensive assignment type\n' +
    '- Ideal lineup role (starter, spark plug, closer, etc.)\n' +
    '- Play types that maximize their cognitive profile\n' +
    (competitionLevel ? '- Recommendations calibrated to ' + competitionLevel + ' competition\n' : '') +
    '\n' +

    '📈 DEVELOPMENT PATH\n' +
    '- Current overall: L' + overallLevel + '. Target: L' + Math.min(overallLevel + 2, 10) + '\n' +
    '- Specific Hooporia drills to prioritize (name THE REACT, THE RECALL, etc.)\n' +
    '- Recommended training frequency and duration\n' +
    '- What reaching the next level would unlock on the court\n' +
    '- Timeline estimate (e.g., "4-6 weeks of focused training")\n\n' +

    'WRITING RULES:\n' +
    '- Write like an elite professional scout, not an AI — direct, confident, specific\n' +
    '- Every sentence must reference a basketball scenario, play, or situation\n' +
    '- NEVER use generic phrases like "shows promise" or "has potential" without specific context\n' +
    '- Use basketball terminology naturally: pick-and-roll, iso, drive-and-kick, weak-side, help defense, closeout, skip pass, outlet, drag screen, etc.\n' +
    '- Reference their RITNOME™ dimensions by name (React, Instinct, Track, Navigate, Observe, Meter)\n' +
    (position ? '- Write EVERY section specific to their position (' + position + '). A PG report should read completely different from a C report.\n' : '') +
    (dominantHand ? '- Reference their dominant hand (' + dominantHand + ') in offensive and defensive analysis\n' : '') +
    (playStyle ? '- Write through the lens of their play style (' + playStyle + ')\n' : '') +
    (competitionLevel ? '- Calibrate all analysis to their competition level (' + competitionLevel + ') — don\'t compare a rec league player to NBA standards\n' : '') +
    (age ? '- Consider their age (' + age + ') — cognitive development context matters for younger players\n' : '') +
    '- Keep total report between 500-700 words\n' +
    '- Do NOT use markdown formatting — use plain text with the emoji headers\n' +
    '- This report will be shared with coaches, scouts, and family — make it worth the premium price\n' +
    '- End with a memorable one-line summary of this player\'s cognitive identity';

  try {
    var response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2000,
        messages: [
          { role: 'user', content: prompt }
        ]
      })
    });

    if (!response.ok) {
      var errText = await response.text();
      console.error('Anthropic API error:', errText);
      return res.status(500).json({ error: 'Report generation failed' });
    }

    var data = await response.json();
    var reportText = '';
    if (data.content && data.content.length) {
      data.content.forEach(function(block) {
        if (block.type === 'text') reportText += block.text;
      });
    }

    return res.status(200).json({
      report: reportText,
      overall_level: overallLevel,
      overall_rating: overallRating,
      tests_completed: testCount,
      strengths: strengthTests.map(function(s) { return s.name + ' L' + s.level; }),
      development: weakTests.map(function(s) { return s.name + ' L' + s.level; }),
      generated_at: new Date().toISOString()
    });
  } catch (err) {
    console.error('Report generation error:', err);
    return res.status(500).json({ error: 'Failed to generate report' });
  }
};
