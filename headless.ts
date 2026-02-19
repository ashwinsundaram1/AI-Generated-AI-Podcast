
/**
 * HEADLESS BROADCASTER (v0.9.7)
 * Subfolder Delivery + Real-time Grounding + Auto-indexing
 */
import process from 'process';
import { fetchAINews, generatePodcastScript, generateSegmentAudio, generateEpisodeMetadata } from './services/gemini.ts';
import { generateRSSFeed } from './utils/rss.ts';
import { PodcastEpisode } from './types.ts';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { Buffer } from 'buffer';

const IS_TEST = process.env.IS_TEST === 'true';
const RSS_DIR = 'rss';
const DB_PATH = path.join(RSS_DIR, 'episodes.json');

async function run() {
  console.log('--- AI DAILY PULSE: CLOUD BROADCAST ENGINE v0.9.7 ---');
  // Fix: Explicitly use imported process to ensure cwd() is properly typed for the Node.js environment
  console.log(`Working Directory: ${process.cwd()}`);
  
  if (!fs.existsSync(RSS_DIR)) {
    console.log(`Creating ${RSS_DIR} sub-directory...`);
    fs.mkdirSync(RSS_DIR, { recursive: true });
  }

  const id = Date.now().toString();
  const filename = `AI-Pulse-${id}.mp3`;
  const filePath = path.join(RSS_DIR, filename);
  const pcmFile = `temp-${id}.pcm`;

  try {
    let script = "";
    let report: any = null;
    let title = "";

    if (IS_TEST) {
      console.log('[DIAGNOSTIC] Running sine test production...');
      execSync(`ffmpeg -f lavfi -i "sine=frequency=440:duration=1" -acodec libmp3lame -ab 128k ${filePath}`);
      script = "Diagnostic Heartbeat Successful.";
      report = { topStories: ["System Check"] };
      title = "System Diagnostic: Automated Verification of Cloud Infrastructure and Broadcasting Engine Services";
    } else {
      console.log('Step 1: Real-time Temporal Intelligence Gathering...');
      report = await fetchAINews();
      console.log('Step 2: Scripting 15-Minute Newscast...');
      script = await generatePodcastScript(report.newsText);
      console.log('Step 3: Generating Optimized Metadata...');
      title = await generateEpisodeMetadata(report.newsText);
      
      console.log('Step 4: Multi-Speaker Production...');
      const segments = script.split('[TRANSITION]').filter(s => s.trim().length > 5);
      if (fs.existsSync(pcmFile)) fs.unlinkSync(pcmFile);

      for (let i = 0; i < segments.length; i++) {
        console.log(`   -> Production Segment ${i+1}/${segments.length}...`);
        const chunks = await generateSegmentAudio(segments[i]);
        for (const chunk of chunks) {
          fs.appendFileSync(pcmFile, Buffer.from(chunk, 'base64'));
        }
      }
      
      console.log('Step 5: Audio Mastering & LAME Encoding...');
      if (fs.existsSync(pcmFile)) {
        execSync(`ffmpeg -y -f s16le -ar 24000 -ac 1 -i ${pcmFile} -acodec libmp3lame -ab 128k ${filePath}`);
        fs.unlinkSync(pcmFile);
      } else {
        throw new Error("PCM production failed. No audio data generated.");
      }
    }

    // Database Sync
    let episodes: PodcastEpisode[] = [];
    if (fs.existsSync(DB_PATH)) {
      episodes = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
    }

    // Add current run
    const newEpisode: PodcastEpisode = {
      id: id,
      date: new Date().toISOString(),
      title: title,
      script: script,
      audioUrl: filename,
      topics: report.topStories,
      mainStories: report.topStories,
      status: 'published'
    };
    episodes.unshift(newEpisode);

    // Auto-Discovery of external files
    console.log('Step 6: Syncing assets in rss/ folder...');
    const files = fs.readdirSync(RSS_DIR);
    console.log(`Found ${files.length} files in ${RSS_DIR}`);
    
    for (const file of files.filter(f => f.endsWith('.mp3'))) {
      if (!episodes.find(e => e.audioUrl === file)) {
        console.log(`   -> New asset discovered: ${file}.`);
        const stats = fs.statSync(path.join(RSS_DIR, file));
        episodes.push({
          id: `archive-${Date.now()}-${file}`,
          date: stats.birthtime.toISOString(),
          title: `Broadcast Archive: ${file}`,
          script: "Archived content summary not available.",
          audioUrl: file,
          topics: ["Archived Intelligence"],
          mainStories: ["Restored from station backups"],
          status: 'published'
        });
      }
    }

    // Save DB and generate RSS
    fs.writeFileSync(DB_PATH, JSON.stringify(episodes, null, 2));

    const repoPath = process.env.GITHUB_REPOSITORY || 'sunisankara/ai-pulse-podcast';
    const [owner, repoName] = repoPath.split('/');
    const baseUrl = `https://${owner}.github.io/${repoName}`;

    console.log(`Step 7: Rebuilding Feed to ${baseUrl}/rss/feed.xml...`);
    const rssContent = generateRSSFeed(episodes, `${baseUrl}/rss`); 
    fs.writeFileSync(path.join(RSS_DIR, 'feed.xml'), rssContent);
    
    console.log('--- STATION BROADCAST COMPLETE ---');
  } catch (error: any) {
    console.error('--- CRITICAL ENGINE FAULT ---');
    console.error(error.message);
    // Fix: Use imported process to correctly call exit() with proper typing
    if (typeof process !== 'undefined' && process.exit) {
      process.exit(1);
    }
  }
}

run();
