const { Client, GatewayIntentBits, Partials } = require('discord.js');

exports.handler = async () => {
  // 환경 변수
  const BOT_TOKEN            = process.env.BOT_TOKEN;
  const CHANNEL_ID           = process.env.CHANNEL_ID;
  const THREAD_FMT           = process.env.THREAD_NAME_FORMAT || '스크럼 {date}';
  const GITHUB_TOKEN         = process.env.GITHUB_TOKEN;
  const OWNER                = process.env.GITHUB_OWNER;
  const REPO                 = process.env.GITHUB_REPO;
  const PROJECT_NUMBER       = parseInt(process.env.GITHUB_PROJECT_NUMBER, 10);

  // Octokit 동적 import (ESM 모듈)
  const { Octokit } = await import('@octokit/rest');

  // 날짜 계산 (KST 기준)
  const now    = new Date();
  const kstNow = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const year   = kstNow.getFullYear();
  const month  = String(kstNow.getMonth() + 1).padStart(2, '0');
  const day    = String(kstNow.getDate()).padStart(2, '0');
  const formattedDate = `${year}년 ${month}월 ${day}일`;
  const isoDate       = `${year}-${month}-${day}`;
  const threadName    = THREAD_FMT.replace('{date}', isoDate);

  // Discord 클라이언트 생성
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
      GatewayIntentBits.GuildMembers
    ],
    partials: [ Partials.Message, Partials.Channel, Partials.GuildMember ]
  });
  await client.login(BOT_TOKEN);

  // 스레드 찾기
  const channel = await client.channels.fetch(CHANNEL_ID);
  let thread = (await channel.threads.fetchActive()).threads
    .find(t => t.name === threadName);
  if (!thread) {
    const archived = await channel.threads.fetchArchived({ type: 'public', limit: 100 });
    thread = archived.threads.find(t => t.name === threadName);
  }
  if (!thread) {
    await client.destroy();
    throw new Error(`오늘(${isoDate}) 스크럼 스레드를 찾을 수 없습니다.`);
  }

  // 메시지 수집
  const fetched = await thread.messages.fetch({ limit: 100 });
  const msgs = Array.from(fetched.values())
    .sort((a,b) => a.createdTimestamp - b.createdTimestamp)
    .filter(msg => !msg.author.bot);

  // 스크럼 메시지가 없으면 GitHub 업로드 건너뛰기
  if (msgs.length === 0) {
    await client.destroy();
    return { statusCode: 200, body: 'No scrum messages found; skipping upload.' };
  }

  // 섹션1: 아젠다/결과/피드백 테이블
  const header = [
    '| no | 아젠다 | 제안자 | 답변자 | 답변 내용 | 피드백 | 결과 |',
    '|----|--------|--------|--------|-----------|--------|------|'
  ];
  const rows = [];
  let idx = 1;
  for (const msg of msgs) {
    const member   = msg.member ?? await thread.guild.members.fetch(msg.author.id);
    const responder = member.displayName.split('.')[0];
    const proposer  = 'nilla';
    msg.content.split('\n').forEach(line => {
      const match = line.match(/^(.+?):\s*(.*)$/);
      if (!match) return;
      rows.push(
        `| ${idx++}  | ${match[1].trim()} | ${proposer} | ${responder} | ${match[2].trim() || '-'} |  |  |`
      );
    });
  }
  const section1 = [
    
    '## 1. 아젠다/결과/피드백',
    '',
    ...header,
    ...rows
  ].join('\n');

  // 섹션2: Will do
  const section2 = [
    '<br />',
    '',
    '## 2. Will do (누가 언제까지 무엇을)',
    '',
    '| 무엇을 | 누가 | 목표/목적 | 언제까지 |',
    '|--------|------|-----------|----------|'
  ].join('\n');

  // 섹션3: TBD
  const section3 = [
    '<br />',
    '',
    '## 3. TBD (논의가 완료되지 않은 아젠다)',
    '',
    '| 내용 | 비고 | 종류 | 의사 결정자 | 논의 대상자 |',
    '|------|------|------|------------|------------|'
  ].join('\n');

  // GitHub 이슈 생성
  const octokit = new Octokit({ auth: GITHUB_TOKEN });
  const issue = await octokit.issues.create({
    owner: OWNER,
    repo: REPO,
    title: `[스크럼] ${formattedDate}`,
    body: [section1, section2, section3].join('\n'),
    labels: ['데일리-스크럼']
  });

  // 프로젝트 카드 추가 (GraphQL)
  const graphql = octokit.graphql.defaults({
    headers: { authorization: `token ${GITHUB_TOKEN}` }
  });
  // 프로젝트 Node ID 조회
  const {
    organization: { projectV2: { id: projectId } }
  } = await graphql(
    `query($org:String!,$num:Int!){
      organization(login:$org){ projectV2(number:$num){ id } }
    }`,
    { org: OWNER, num: PROJECT_NUMBER }
  );
  // 카드 추가
  await graphql(
    `mutation($projId:ID!,$contentId:ID!){
      addProjectV2ItemById(input:{ projectId:$projId, contentId:$contentId }){ item{ id } }
    }`,
    { projId: projectId, contentId: issue.data.node_id }
  );

  // Discord에도 요약 전송
  const mdTable = ['```markdown', ...header, ...rows, '```'].join('\n');
  await thread.send({ content: `📋 **스크럼 표 작성을 완료했어요**\n${mdTable}` });

  await client.destroy();
  return { statusCode: 200, body: 'Issue created, card added, summary posted.' };
};
  