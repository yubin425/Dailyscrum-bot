# Dailyscrum-bot
카테부 파이널 20조 데일리스크럼 봇

## 설명
디스코드에 각자 스크럼 내용을 적으면, 취합하여 자동으로 깃허브 프로젝트에 업로드까지 해주는 봇입니다.
아젠다 : 쓸말 형식으로 적어야 하며 다른 내용을 적고 싶다면 엔터를 치거나 다른 메세지로 전송하면 됩니다.
작성자는 풀네임 기준 . 앞의 서버 닉네임을 가져옵니다. (ex nilla.lim -> nilla)
팀 디스코드 환경에 맞춰 코드를 수정해 사용하시길 바랍니다. 

## 사용 방법

1. discord 봇 생성
-  https://discord.com/developers/applications 에 접속해 new application 선택
-  bot tab을 누르고 다음과 같이 설정
   -   Server Members Intent, Message Content Intent를 허용. 
   -   reset token을 눌러 토큰 발급
- oauth2 tab을 누르고 다음과 같이 설정
  - 권한(Scopes) → bot, applications.commands
  - 권한(Permissions) → Send Messages, Read Message History, Manage Threads, Send Messages in Threads
  - 발급받은 url로 채널에 봇 설치, 이후 봇이 활동할 채널 ID를 복사하기

2. lambda 설정
- lambda 함수를 두개 생성 (collectSummary, sendReminder)
- 각각 코드를 집어넣고 다음과 같이 환경 변수를 설정한다
   - collectSummary (스크럼 취합) : BOT_TOKEN (봇 토큰 입력), CHANNEL_ID(채널 id 입력), GITHUB_OWNER(	
100-hours-a-week), GITHUB_PROJECT_NUMBER(깃허브 프로젝트의 번호), GITHUB_REPO(위키 레포명),GITHUB_TOKEN(토큰), THREAD_NAME_FORMAT(스크럼-{date})
   - sendReminder(스크럼 스레드 생성) : BOT_TOKEN (봇 토큰 입력), CHANNEL_ID(채널 id 입력), THREAD_NAME_FORMAT(스크럼-{date})
- 깃허브 토큰에는 public-repo, project full 권한을 부여해주어야 합니다. 

3. EventBridge 설정
- lambda의 트리거에 들어가 eventbridge를 설정합니다. 
- 20조의 경우 매주 평일 8시 50분에 sendReminder가 동작하고, 10시에 collectSummary가 돌아갑니다.
- 8시 50분 cron 식 : cron(50 23 ? * SUN-THU *)
- 10시 cron 식 : cron(0 1 ? * MON-FRI *)
- 주의 : eventbridge는 휴일을 인식하지 못합니다. 스크럼에 아무 메시지도 없으면 github 업로드는 건너뛰게 설정해두었으나,
  휴일에는 수동으로 꺼두시는 것을 추천드립니다.
