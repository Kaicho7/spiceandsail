/**
 * ZANZIABR CSV-Driven Weekly Content Expansion
 * 
 * Auto-generates 1 new problem-solution page per week using ZANZIABR CSV research data.
 * 
 * Research sources tracked:
 * - content_ideas_for_zanzibar.csv: NYT '36 Hours in Zanzibar' (2271 est. visits, 17 backlinks)
 * - top_pages_for_africanbudgetsafaris.com.csv: tribes/culture (1691 visits potential, 19 backlinks)
 * - content gaps: safety, packing, timing, family, romance, self-drive, cultural
 */

const fs = require('fs');
const path = require('path');

const CONFIG = {
  researchDir: path.join(__dirname, 'ZANZIABR'),
  dataDir: path.join(__dirname, 'src/data'),
  pagesDir: path.join(__dirname, 'src/pages'),
  templatesDir: path.join(__dirname, 'src/_includes'),
  weeklyTopicHistoryPath: path.join(__dirname, '.weekly-topics.json'),
  templateName: 'problem-solution-template.njk'
};

// Weekly research topics from CSV data
const WEEKLY_RESEARCH = [
  {
    week: 1,
    source: 'content_ideas_for_zanzibar.csv',
    title: '36 Hours in Zanzibar - NYT Feature',
    domain: 'timing',
    problem: 'limited time in Zanzibar, what to prioritize',
    csvReference: 'NYT article: 36 Hours in Zanzibar, Tanzania (2271 est. visits, 17 backlinks)',
    seoKeywords: ['zanzibar 36 hours', 'zanzibar short stay itinerary', 'zanzibar first time visit'],
    ctaText: 'Message us on WhatsApp to customize your 36-hour Zanzibar adventure'
  },
  {
    week: 2,
    source: 'top_pages_for_africanbudgetsafaris.com.csv',
    title: 'Zanzibar Cultural Experiences Beyond the Typical',
    domain: 'cultural',
    problem: 'beyond the typical cultural tour, authentic local experiences',
    csvReference: 'African Budget Safaris tribes/culture: 1,691 visits potential, 19 backlinks',
    seoKeywords: ['zanzibar cultural experiences', 'authentic zanzibar tribes', 'zanzibar local traditions'],
    ctaText: 'Message us on WhatsApp for authentic Zanzibar cultural experiences'
  },
  {
    week: 3,
    source: 'content_ideas_for_zanzibar.csv',
    title: '40 Amazing Things To See & Do in Zanzibar',
    domain: 'packing',
    problem: 'overwhelming choice, where to start',
    csvReference: 'Helen in Wonderlust article (21 visits, 11 backlinks)',
    seoKeywords: ['zanzibar things to do', 'zanzibar activities list', 'zanzibar experience categories'],
    ctaText: 'Message us on WhatsApp for a personalized Zanzibar experiences list'
  },
  {
    week: 4,
    source: 'top_pages_for_africanbudgetsafaris.com.csv',
    title: 'Zanzibar Safety & Health Guide',
    domain: 'safety',
    problem: 'concerns about malaria, safe beaches, turtle encounters',
    csvReference: '2,900 monthly searches for "zanzibar malaria", comprehensive health guide',
    seoKeywords: ['zanzibar malaria', 'zanzibar safe beaches', 'zanzibar antimalarials'],
    ctaText: 'Message us on WhatsApp with specific health concern'
  },
  {
    week: 5,
    source: 'content_ideas_for_zanzibar.csv',
    title: 'Zanzibar With Kids: Family Travel Guide',
    domain: 'family',
    problem: 'safe beaches, kid activities, family-friendly accommodations',
    csvReference: 'Colors of Zanzibar validation: 12 FB shares, proven family interest',
    seoKeywords: ['zanzibar family travel', 'zanzibar kids activities', 'zanzibar safe beaches children'],
    ctaText: 'Message us on WhatsApp with children\'s ages and interests'
  },
  {
    week: 6,
    source: 'content_ideas_for_zanzibar.csv',
    title: 'Zanzibar Honeymoon: Romantic Packages & Itineraries',
    domain: 'romance',
    problem: 'romantic sunset dhow cruises, private beach dinners, spas',
    csvReference: '260 monthly searches, $2.75 CPC for honeymoon packages',
    seoKeywords: ['zanzibar honeymoon', 'romantic zanzibar', 'honeymoon packages zanzibar'],
    ctaText: 'Message us on WhatsApp with preferred style and budget'
  },
  {
    week: 7,
    source: 'top_pages_for_africanbudgetsafaris.com.csv',
    title: 'Zanzibar Self-Drive & 4x4 Hire',
    domain: 'transport',
    problem: 'rental guidelines, vehicle options, fuel policy, age requirements',
    csvReference: 'Competitor analysis shows high interest in safari & transport content',
    seoKeywords: ['zanzibar self-drive', 'zanzicar 4x4 rental', 'zanzibar car rental guidelines'],
    ctaText: 'Message us on WhatsApp with preferred vehicle type pickup date duration'
  }
];

/**
 * Load weekly topic history to avoid duplicates
 */
function loadTopicHistory() {
  try {
    if (fs.existsSync(CONFIG.weeklyTopicHistoryPath)) {
      return JSON.parse(fs.readFileSync(CONFIG.weeklyTopicHistoryPath, 'utf8'));
    }
    return { usedWeeks: [], lastUpdated: new Date().toISOString() };
  } catch (error) {
    console.error('Error loading topic history:', error.message);
    return { usedWeeks: [], lastUpdated: new Date().toISOString() };
  }
}

/**
 * Save weekly topic history
 */
function saveTopicHistory(history) {
  try {
    history.lastUpdated = new Date().toISOString();
    fs.writeFileSync(CONFIG.weeklyTopicHistoryPath, JSON.stringify(history, null, 2));
    console.log('✓ Topic history saved to', CONFIG.weeklyTopicHistoryPath);
  } catch (error) {
    console.error('Error saving topic history:', error.message);
  }
}

/**
 * Get next available week
 */
function getNextWeek() {
  const history = loadTopicHistory();
  const usedWeeks = history.usedWeeks || [];
  // Filter out null/undefined entries
  const validWeeks = usedWeeks.filter(w => w && typeof w === 'number');
  let nextWeek = 1;
  
  while (validWeeks.includes(nextWeek)) {
    nextWeek++;
  }
  
  return nextWeek;
}

/**
 * Mark week as used
 */
function markWeekUsed(week) {
  const history = loadTopicHistory();
  history.usedWeeks = history.usedWeeks || [];
  if (!history.usedWeeks.includes(week)) {
    history.usedWeeks.push(week);
  }
  history.lastUpdated = new Date().toISOString();
  saveTopicHistory(history);
}

/**
 * Get weekly research topic by number
 */
function getWeeklyTopic(weekNumber) {
  // Wrap around if all weeks used
  const totalWeeks = WEEKLY_RESEARCH.length;
  const index = (weekNumber - 1) % totalWeeks;
  return { ...WEEKLY_RESEARCH[index], week: weekNumber };
}

/**
 * Create new problem-solution page from research topic
 */
function createWeeklyPage(weekNumber) {
  const topic = getWeeklyTopic(weekNumber);
  
  // Check if already used
  const history = loadTopicHistory();
  if (history.usedWeeks.includes(weekNumber)) {
    console.log(`⚠️ Week ${weekNumber} already used. Selecting next available week.`);
    return createWeeklyPage(getNextWeek());
  }
  
  // Mark week as used
  markWeekUsed(weekNumber);
  
  // Get template
  const templatePath = path.join(CONFIG.templatesDir, CONFIG.templateName);
  if (!fs.existsSync(templatePath)) {
    console.error('Template not found:', templatePath);
    console.log('Create template at:', templatePath);
    return null;
  }
  
  const template = fs.readFileSync(templatePath, 'utf8');
  
  // Populate page with research data
  const pageContent = topic.title.includes('36 Hours')
    ? template
        .replace(/{{TOPIC_SLUG}}/g, 'thirty-six-hours')
        .replace(/{{TITLE}}/g, topic.title)
        .replace(/{{DOMAIN}}/g, topic.domain)
        .replace(/{{PROBLEM}}/g, topic.problem)
        .replace(/{{CTA_TEXT}}/g, topic.ctaText)
        .replace(/{{WHATSAPP_NUMBER}}/g, '255672450934')
        .replace(/{{SOURCE}}/g, topic.source)
        .replace(/{{WEEK}}/g, new Date().toISOString().split('T')[0])
    : template
        .replace(/{{TOPIC_SLUG}}/g, topic.topic || topic.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''))
        .replace(/{{TITLE}}/g, topic.title)
        .replace(/{{DOMAIN}}/g, topic.domain)
        .replace(/{{PROBLEM}}/g, topic.problem)
        .replace(/{{CTA_TEXT}}/g, topic.ctaText)
        .replace(/{{WHATSAPP_NUMBER}}/g, '255672450934')
        .replace(/{{SOURCE}}/g, topic.source)
        .replace(/{{WEEK}}/g, new Date().toISOString().split('T')[0]);
  
  const outputPath = path.join(CONFIG.pagesDir, `${topic.topic || topic.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}.njk`);
  
  try {
    fs.writeFileSync(outputPath, pageContent);
    console.log(`✓ Created weekly page [${weekNumber}]: ${outputPath}`);
    console.log(`  Title: ${topic.title}`);
    console.log(`  Source: ${topic.source}`);
    console.log(`  Domain: ${topic.domain}`);
    console.log(`  Problem: ${topic.problem}`);
    
    return { slug: topic.topic || topic.title.toLowerCase().replace(/[^a-z0-9]+/g, '-'), ...topic };
  } catch (error) {
    console.error('Error creating weekly page:', error.message);
    return null;
  }
}

/**
 * Get the full research analysis file content
 */
function getResearchAnalysis() {
  const analysisPath = path.join(CONFIG.researchDir, 'ZANZIABR_content_ideas_analysis.md');
  if (fs.existsSync(analysisPath)) {
    return fs.readFileSync(analysisPath, 'utf8');
  }
  return 'Research analysis file not found. Please ensure ZANZIABR_content_ideas_analysis.md exists.';
}

/**
 * CLI interface
 */
function cli(args) {
  const command = args[0];
  
  switch (command) {
    case 'next':
      const nextWeek = getNextWeek();
      console.log(`\n=== NEXT WEEK (${nextWeek}) ===\n`);
      const topic = getWeeklyTopic(nextWeek);
      console.log(`Title: ${topic.title}`);
      console.log(`Domain: ${topic.domain}`);
      console.log(`Problem: ${topic.problem}`);
      console.log(`Source: ${topic.source}`);
      console.log(`CSV Reference: ${topic.csvReference}`);
      console.log(`SEO Keywords: ${topic.seoKeywords.join(', ')}`);
      console.log(`CTA: ${topic.ctaText}`);
      break;
      
    case 'create':
      const newPage = createWeeklyPage();
      if (newPage) {
        console.log('\nPage created. Run deploy to publish.');
      }
      break;
      
    case 'list':
      console.log('\n=== ZANZIABR Weekly Research Schedule ===');
      WEEKLY_RESEARCH.forEach((week, i) => {
        console.log(`\nWeek ${week.week}: ${week.title}`);
        console.log(`  Domain: ${week.domain}`);
        console.log(`  Problem: ${week.problem}`);
        console.log(`  Source: ${week.csvReference}`);
      });
      console.log('\nCurrent week tracker:', loadTopicHistory());
      break;
      
    case 'research':
      console.log('\n=== ZANZIABR RESEARCH ANALYSIS ===');
      console.log(getResearchAnalysis());
      break;
      
    case 'full':
      const created = createWeeklyPage();
      if (created) {
        console.log('\nDeploying to Netlify...');
        try {
          execSync('git add -A', { cwd: __dirname, stdio: 'inherit' });
          execSync(`git commit -m "weekly content: ${created.slug} - ${created.title}"`, { cwd: __dirname, stdio: 'inherit' });
          execSync('git push origin master', { cwd: __dirname, stdio: 'inherit' });
          console.log('✓ Deployed to Netlify');
        } catch (error) {
          console.log('Commit may already exist or git error:', error.message);
        }
      }
      break;
      
    default:
      console.log(`
ZANZIABR Weekly Content Expansion CLI

Commands:
  next                                          Show next week's research topic
  create                                          Create new page from research
  list                                            Show full weekly schedule
  research                                        Show full research analysis
  full                                            Create and deploy new page

Research Sources:
  - content_ideas_for_zanzibar.csv: NYT '36 Hours' (2271 visits, 17 backlinks)
  - top_pages_for_africanbudgetsafaris.com.csv: tribes/culture (1691 visits, 19 backlinks)
  
  7-week cycle covering: timing, cultural, packing, safety, family, romance, transport
      `);
  }
}

cli(process.argv.slice(2));