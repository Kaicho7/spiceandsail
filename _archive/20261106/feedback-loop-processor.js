/**
 * WhatsApp Conversation Feedback Loop Processor
 * 
 * This script processes WhatsApp conversation insights and feeds them into
 * the weekly content expansion pipeline for the Dhow Coast Travels site.
 * 
 * Usage: node feedback-loop-processor.js --process --week="2026-W43"
 * 
 * The feedback loop mechanism:
 * 1. Collect top 3 questions from WhatsApp conversations per domain
 * 2. Feed top question into next week's new page topic
 * 3. Auto-generate problem-solution page using template
 * 4. Deploy via git push to Netlify
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Configuration
const CONFIG = {
  dataDir: path.join(__dirname, 'src/data'),
  pagesDir: path.join(__dirname, 'src/pages'),
  templatesDir: path.join(__dirname, 'src/_includes'),
  templates: {
    problemSolution: path.join(__dirname, 'src/pages/_templates/problem-solution-template.njk')
  },
  whatsappTemplates: path.join(__dirname, 'src/data/whatsapp-conversation-templates.json'),
  insightsLog: path.join(__dirname, 'conversation-insights.json'),
  researchData: {
    contentIdeas: path.join(__dirname, 'ZANZIABR_content_ideas_analysis.md')
  }
};

// Problem domains from the WhatsApp conversation templates
const DOMAINS = [
  'safety', 'romance', 'transport', 'timing', 
  'cultural', 'packing', 'spice'
];

/**
 * Load conversation insights from JSON log
 */
function loadInsights() {
  try {
    if (fs.existsSync(CONFIG.insightsLog)) {
      return JSON.parse(fs.readFileSync(CONFIG.insightsLog, 'utf8'));
    }
    return { domains: {}, lastUpdated: new Date().toISOString() };
  } catch (error) {
    console.error('Error loading insights:', error.message);
    return { domains: {}, lastUpdated: new Date().toISOString() };
  }
}

/**
 * Save conversation insights
 */
function saveInsights(insights) {
  try {
    insights.lastUpdated = new Date().toISOString();
    fs.writeFileSync(CONFIG.insightsLog, JSON.stringify(insights, null, 2));
    console.log('✓ Insights saved to', CONFIG.insightsLog);
  } catch (error) {
    console.error('Error saving insights:', error.message);
  }
}

/**
 * Record a conversation insight
 */
function recordInsight(domain, question, count = 1) {
  if (!DOMAINS.includes(domain)) {
    console.error(`Invalid domain: ${domain}. Must be one of: ${DOMAINS.join(', ')}`);
    return;
  }
  
  const insights = loadInsights();
  if (!insights.domains[domain]) {
    insights.domains[domain] = {};
  }
  
  insights.domains[domain][question] = (insights.domains[domain][question] || 0) + count;
  saveInsights(insights);
  
  console.log(`✓ Recorded insight for ${domain}: "${question}" (count: ${insights.domains[domain][question]})`);
}

/**
 * Get top questions for each domain
 */
function getTopQuestions(limit = 3) {
  const insights = loadInsights();
  const results = {};
  
  for (const domain of DOMAINS) {
    if (insights.domains[domain]) {
      const sorted = Object.entries(insights.domains[domain])
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit)
        .map(([question, count]) => ({ question, count }));
      if (sorted.length > 0) {
        results[domain] = sorted;
      }
    }
  }
  
  return results;
}

/**
 * Generate next week's page topic from top insights
 */
function generateNextTopic() {
  const topQuestions = getTopQuestions(1);
  const candidates = [];
  
  for (const [domain, questions] of Object.entries(topQuestions)) {
    if (questions.length > 0) {
      candidates.push({
        domain,
        question: questions[0].question,
        count: questions[0].count
      });
    }
  }
  
  if (candidates.length === 0) {
    console.log('No conversation insights yet. Using research data for next topic.');
    return generateTopicFromResearch();
  }
  
  // Sort by count (most asked question wins)
  candidates.sort((a, b) => b.count - a.count);
  return candidates[0];
}

/**
 * Generate topic from ZANZIABR CSV research data
 */
function generateTopicFromResearch() {
  const researchTopics = [
    { domain: 'timing', topic: 'thirty-six-hours', title: '36 Hours in Zanzibar', source: 'NYT article (2271 est. visits, 17 backlinks)' },
    { domain: 'cultural', topic: 'zanzibar-tribes-extra', title: 'Authentic Zanzibar Cultural Experiences', source: 'African Budget Safaris tribes/culture (1691 visits, 19 backlinks)' },
    { domain: 'spice', topic: 'forty-things', title: '40 Amazing Things To See & Do in Zanzibar', source: 'Helen in Wonderlust article (21 visits, 11 backlinks)' },
    { domain: 'safety', topic: 'zanzibar-health-guide', title: 'Complete Zanzibar Health & Safety Guide', source: '2900 monthly searches for "zanzibar malaria"' },
    { domain: 'family', topic: 'zanzibar-with-kids', title: 'Zanzibar With Kids: Complete Family Guide', source: 'Colors of Zanzibar validation (12 FB shares)' },
    { domain: 'romance', topic: 'zanzibar-honeymoon-ultimate', title: 'Ultimate Zanzibar Honeymoon Planner', source: '260 monthly searches, $2.75 CPC' },
    { domain: 'transport', topic: 'zanzibar-self-drive-complete', title: 'Complete Self-Drive Zanzibar Guide', source: 'Untapped niche - no direct competitors' }
  ];
  
  // Rotate through topics or pick based on current priorities
  const today = new Date();
  const weekNumber = Math.floor((today.getTime() - new Date('2026-10-23').getTime()) / (7 * 24 * 60 * 60 * 1000));
  const index = weekNumber % researchTopics.length;
  
  return {
    ...researchTopics[index],
    fromResearch: true,
    week: weekNumber
  };
}

/**
 * Create new problem-solution page from template
 */
function createPageFromTopic(topic) {
  const templatePath = CONFIG.templates.problemSolution;
  if (!fs.existsSync(templatePath)) {
    console.error('Template not found:', templatePath);
    console.log('Create template first at:', templatePath);
    return false;
  }
  
  const template = fs.readFileSync(templatePath, 'utf8');
  const slug = topic.topic || topic.question.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const title = topic.title || topic.question;
  const domain = topic.domain;
  
  // Get intent data for this domain
  const intentMap = {
    safety: { problem: 'zanzibar safety malaria mosquito nets', cta_text: 'Message us on WhatsApp with specific safety concern' },
    romance: { problem: 'zanzibar honeymoon romantic sunset dhow', cta_text: 'Message us on WhatsApp with preferred style and budget' },
    transport: { problem: 'zanzibar self-drive rental vehicle', cta_text: 'Message us on WhatsApp with preferred vehicle type pickup date duration' },
    timing: { problem: 'zanzibar migration calendar turtle nesting', cta_text: 'Message us on WhatsApp with preferred travel month' },
    cultural: { problem: 'zanzibar swahili culture traditions', cta_text: 'Message us on WhatsApp for custom cultural itineraries' },
    packing: { problem: 'zanzibar packing essentials seasonal', cta_text: 'Message us on WhatsApp for personalized packing list' },
    spice: { problem: 'zanzibar spice farm cloves vanilla', cta_text: 'Message us on WhatsApp to arrange spice farm visit' }
  };
  
  const intent = intentMap[domain] || { problem: 'zanzibar travel', cta_text: 'Message us on WhatsApp for customized itinerary' };
  
  // Replace template placeholders
  const pageContent = template
    .replace(/{{TOPIC_SLUG}}/g, slug)
    .replace(/{{TITLE}}/g, title)
    .replace(/{{DOMAIN}}/g, domain)
    .replace(/{{PROBLEM}}/g, intent.problem)
    .replace(/{{CTA_TEXT}}/g, intent.cta_text)
    .replace(/{{WHATSAPP_NUMBER}}/g, '255672450934')
    .replace(/{{SOURCE}}/g, topic.source || 'Conversation insights + ZANZIABR research')
    .replace(/{{WEEK}}/g, new Date().toISOString().split('T')[0]);
  
  const outputPath = path.join(CONFIG.pagesDir, `${slug}.njk`);
  
  try {
    fs.writeFileSync(outputPath, pageContent);
    console.log(`✓ Created new page: ${outputPath}`);
    console.log(`  Title: ${title}`);
    console.log(`  Domain: ${domain}`);
    console.log(`  Source: ${topic.source || 'Conversation insights'}`);
    return { slug, title, domain, path: outputPath };
  } catch (error) {
    console.error('Error creating page:', error.message);
    return false;
  }
}

/**
 * Git commit and push new page
 */
function deployPage(pageInfo) {
  if (!pageInfo) return false;
  
  try {
    execSync('git add -A', { cwd: __dirname, stdio: 'inherit' });
    execSync(`git commit -m "weekly content: ${pageInfo.slug} - ${pageInfo.title}"`, { cwd: __dirname, stdio: 'inherit' });
    execSync('git push origin master', { cwd: __dirname, stdio: 'inherit' });
    console.log('✓ Deployed to Netlify via git push');
    return true;
  } catch (error) {
    console.error('Deployment failed:', error.message);
    return false;
  }
}

/**
 * Main CLI handler
 */
function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  
  switch (command) {
    case 'record':
      // node feedback-loop-processor.js record --domain=safety --question="kid-friendly snorkeling" --count=5
      const domainArg = args.find(a => a.startsWith('--domain='));
      const questionArg = args.find(a => a.startsWith('--question='));
      const countArg = args.find(a => a.startsWith('--count='));
      
      if (domainArg && questionArg) {
        const domain = domainArg.split('=')[1];
        const question = questionArg.split('=')[1];
        const count = countArg ? parseInt(countArg.split('=')[1]) : 1;
        recordInsight(domain, question, count);
      } else {
        console.log('Usage: node feedback-loop-processor.js record --domain=<domain> --question="<question>" [--count=<n>]');
      }
      break;
      
    case 'top':
      // node feedback-loop-processor.js top
      const top = getTopQuestions();
      console.log('\n=== TOP CONVERSATION INSIGHTS ===');
      for (const [domain, questions] of Object.entries(top)) {
        console.log(`\n${domain.toUpperCase()}:`);
        questions.forEach((q, i) => console.log(`  ${i+1}. "${q.question}" (${q.count} mentions)`));
      }
      break;
      
    case 'next':
      // node feedback-loop-processor.js next
      const next = generateNextTopic();
      console.log('\n=== NEXT WEEK\'S TOPIC ===');
      console.log(`Domain: ${next.domain}`);
      console.log(`Topic: ${next.topic || next.question}`);
      console.log(`Source: ${next.source || 'Conversation insights'}`);
      console.log(`Count: ${next.count || 'N/A'}`);
      break;
      
    case 'create':
      // node feedback-loop-processor.js create
      const nextTopic = generateNextTopic();
      const page = createPageFromTopic(nextTopic);
      if (page) {
        console.log('\nPage created successfully. Run "node feedback-loop-processor.js deploy" to deploy.');
      }
      break;
      
    case 'deploy':
      // node feedback-loop-processor.js deploy
      deployPage(generateNextTopic());
      break;
      
    case 'full-cycle':
      // node feedback-loop-processor.js full-cycle
      const topic = generateNextTopic();
      const newPage = createPageFromTopic(topic);
      if (newPage) {
        deployPage(newPage);
      }
      break;
      
    default:
      console.log(`
WhatsApp Conversation Feedback Loop Processor

Commands:
  record    --domain=<domain> --question="<question>" [--count=<n>]   Record conversation insight
  top                                           Show top questions per domain
  next                                            Show next week's topic
  create                                          Create next page from insights/research
  deploy                                          Deploy next page to Netlify
  full-cycle                                      Generate, create, and deploy next page

Domains: ${DOMAINS.join(', ')}
      `);
  }
}

main();