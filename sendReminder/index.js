// sendReminder/index.js
const { Client, GatewayIntentBits } = require('discord.js');

exports.handler = async () => {
  const BOT_TOKEN  = process.env.BOT_TOKEN;
  const CHANNEL_ID = process.env.CHANNEL_ID;
  const format     = process.env.THREAD_NAME_FORMAT || '스크럼 {date}';
  // UTC → KST 변환해서 YYYY-MM-DD 얻기
  const now    = new Date();
  const kstNow = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const today  = kstNow.toISOString().slice(0,10);  // KST 기준 날짜

  const threadName = format.replace('{date}', today);

  // 1) Discord 로그인
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages
    ]
  });
  await client.login(BOT_TOKEN);

  // 2) 스크럼 채널 가져오기
  const channel = await client.channels.fetch(CHANNEL_ID);

  // 3) 안내 메시지 전송
  const message = await channel.send({
    content: 
    '☀️ **오늘의 스크럼을 작성해 주세요!**\n 아젠다: 쓸말 형태로 적어주셔야 오류가 나지 않습니다!\n예시:\n' +
    '```\n 오늘 할 일:\n예상되는 이슈:\n작일 회고:```',
  });

  // 4) 메시지로부터 스레드 생성
  //    autoArchiveDuration: 스레드 자동 보관(분) 단위 (최대 10080분 = 7일)
  const thread = await message.startThread({
    name: threadName,
    autoArchiveDuration: 60  // 예: 1시간 뒤 자동 보관
  });

  // 5) (선택) 스레드에 첫 가이드 메시지를 남기고 싶다면
  await thread.send(`👋 새로운 스크럼 스레드를 만들었어요: **${threadName}**\n여기에 스크럼을 남겨주세요!`);

  // 6) 종료
  await client.destroy();
  return { statusCode: 200, body: 'Reminder sent and thread created.' };
};
