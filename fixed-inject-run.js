const CDP = require('chrome-remote-interface');
const http = require('http');
const fs = require('fs');

function getList() {
  return new Promise((resolve, reject) => {
    http.get('http://127.0.0.1:9222/json/list', (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
    }).on('error', reject);
  });
}

(async () => {
  try {
    const list = await getList();
    const spTarget = list.find(t => t.url.includes('sidepanel/sidepanel.html'));
    if (!spTarget) { console.log('ERROR: sidepanel未找到'); process.exit(1); }

    const spClient = await CDP({port: 9222, target: spTarget});
    const {Runtime} = spClient;

    const accounts = [{"email": "KitsonHumphrey1593@outlook.com", "password": "yk228161", "clientId": "9e5f94bc-e8a4-4e73-b8be-63364c29d753", "refreshToken": "M.C537_BL2.0.U.-CpCKABQ9Z2d1!qxNo4ssQNLXCMneYvQWAYePdIg!*OObFc7!Y7bwZVhQOj2IfhI2ikQlIYkWBbmEbT0nXTpJaBMIvR4QPfzrbHFttxoKl41n!ovpDXw0tpOrochZt6I86QP83zOb4lyCy!fRotg!RD83JIv7gAswkINzp95GjQx3jVGiIMQbhfPqDxJOMf9Fx0JCXphfay7AnhsA82cOuYQVjt8zS4Lg5OUwkdpwRe!1RK4ronYU6pA1BgCubKdNX*xY6EigJW8uFj0zzGgCT3W2gZ3RrdNlIBC7d!EOdabFFBxn3JbG8kPiGabkfdT!cdUJxjcxCp17E53yEyO4jAwlFdX82*T5K02SoellMw5gqlwfPaOTaG!2JHpuiwjPd32v2Os2QfDIgAJXbeyvALo$", "status": "authorized", "lastAuthAt": 1747850000000, "enabled": true, "used": false}, {"email": "MelioraCeleste8242@outlook.com", "password": "ki824895", "clientId": "9e5f94bc-e8a4-4e73-b8be-63364c29d753", "refreshToken": "M.C557_BAY.0.U.-Clsw2IhDwLHsdN4g6QbJWoBvxcJ9nD5usmFnfKaoGbAjFF44oOkHNt7DCUzWm9tWtj9cRfy*NE2fnss2IjSerszgEbaHnzuZXjVB8ENlbExHnBHibDGjZwhQO4LdM9KiGNQyBGcRpgHtCPmTtjvRoj2EY7m2be7LGRg8gJsgU12DqpVirP3WC2PcFCz010DZ3A4qxXEVCM6iGNhWOIZv60twbc4v2vUKL1p4UVrN0vBMKwUIjNYuQogurh3PWpvvCLKIpEnTZpMEOhksPS8EahZA3u010HR2*B2Bxh9gJ5WV4NIUK68!W9nZ6*tPI2BFKYOA8coB*aDqhb9n!shyHgNUeaKKG97v2mNoQMX*t43!mP1162Ib3hMDVUHgjEyPG8A9HZX5i5hCHbi661PNVxY$", "status": "authorized", "lastAuthAt": 1747850000000, "enabled": true, "used": false}, {"email": "RuneEstrella8483@outlook.com", "password": "qj357195", "clientId": "9e5f94bc-e8a4-4e73-b8be-63364c29d753", "refreshToken": "M.C516_BL2.0.U.-Ch!wUnTba6N8UHKKRhIN2SYft4rqVx5BPoCiLaHPGQUzajSTKhXJeDbrSL4MfZGVI1tDb3j1tvXZgJBJ*2JJj8Tfay13nhttC1HwQLjDTvXd9nj0Eo8U9b1fw*dOyCdmkvM1r74p8Xo4qgMmgM3sh30gtExTt1JwsO8iAyKS!ii6oNRlE17U5ijxnDMFivElm36nW9pv8JBNipIhf0m0cvi*ZyLDEsCoqN5hjXdBo3iE0nIn5YgXXrOMTsfkgltlrmpsh5UN3wo8JKgGXCDD0!vSM*fcxibZ67jlkM!O0f!p6PdHZsuYAeIyW2Se1H9sINiSbROJ1IBpNBI3cho6GvjSq9MdPYlUKg!6vdUO*QKeeLmExmUmjAEHJvhoA7TxjT0KImsc08LK72ZSW0LNRPI$", "status": "authorized", "lastAuthAt": 1747850000000, "enabled": true, "used": false}, {"email": "ZidanCelestine5161@outlook.com", "password": "ip007039", "clientId": "9e5f94bc-e8a4-4e73-b8be-63364c29d753", "refreshToken": "M.C542_SN1.0.U.-CoTHm0VZ0ux9bMVYtUCA5DXizRaY0mSR1o1CCpQyerXcVyiHSpq8FajIwRsFKuJ2Tp*4pplElRac7onUGx0A*7fYv3k2UdY3hRwaSTyXHzJRR12yCUcLDt2lemO57ttdSPUvG3WypSvQjN3T1MKnLsQDycsjaPP0YRuAgEMrQewcSPO292A2*JpZGqxKsrNHIw41bYFuPtnoKx44fIq1bhOdLROpoGAttI3zi!u0ORWh8P2yBfG7OZglODx6kta8WfP4exxTyIxshvIOfzHyUZTcsajCb523YcL*rsDIo1EXPNWYToE6ONmsMZU9EXT87sRuMG0OcmEI5NSDQLHP*mMw!6EyEEvkqVJR41rk1t!q8bvzAJSn8tRQzGYwbGF5QeMIGB*WFGV7lz5kw6Gtp*0$", "status": "authorized", "lastAuthAt": 1747850000000, "enabled": true, "used": false}, {"email": "LetitiaIngrid8871@outlook.com", "password": "iu467534", "clientId": "9e5f94bc-e8a4-4e73-b8be-63364c29d753", "refreshToken": "M.C516_SN1.0.U.-ChZFJ8qgqygxOm2QaKmhFwTkJXRd9Kdt9ZiltNwRAXY*c05r29bpxs!12HpflryoRPQ3M3pSHQP5E05Qpx6X2uhBGPTZELMAqbTgK0I9X6G9c72rn4uRtuJp8lYCuJwrUPoZlDBYhMe6vnB4EIo9lf1gRxbbyEX3ZLNqD91QsdV8dLE!*1xzCaVMjavsUV8*UyHnJM19iwDo6yQjxdxZYrmi8BSTTZuix17u!6HWse79ohZdBX!AKQ3Xx!hTOsZguurB7Cw6M3kpJeOPeAzr0YP1hNZ10DUAeY95H!7nUpfIkz8uskT4u8!Uwp96PLqsLwojeLK5j86JLf1513zus0IZ2Q69UQONNtiJqu8vTc8gqJItTTXl8F96CG34zGMnbLt06b3Woci9Ug8QtT307i8$", "status": "authorized", "lastAuthAt": 1747850000000, "enabled": true, "used": false}, {"email": "PaulaGianna9142@outlook.com", "password": "of896917", "clientId": "9e5f94bc-e8a4-4e73-b8be-63364c29d753", "refreshToken": "M.C525_SN1.0.U.-CoP!NMNNSLpaegwSY59ShCgw8Wubn5AWrpa11uJBazGmXfvpJvNR17BiNRxKnXiVWrI9qici3Jh3j4jCGqDHzK2dDbPrd*f2V1PQBuOLfe3Co*l31sULYUcXoA*jZ1*bhNTSaANjs0CM4gfZ11T0Ci2kMvNquqlhui7sVB*NgmpddNIEeHQpwR!paJeQJX2YZLbgm6Y8CCRMr526kP5Tc4ogozebjuaeKo4DWyjQE*EpPjxr!PmhtPKPByWiPiYViNA*tp1tmdW1RH!gLGu4j4nfHFZfRXmUNDflW7AAkIHK7I!0UnE9fKpwNB04jufjtbXzxgsO0GunqiZb060VEWseBj1PjLe3S82BT*xt42EbesKjiK131Ji4q7DpmLjAaNl59fZ95UO5IdgX1kzN4Og$", "status": "authorized", "lastAuthAt": 1747850000000, "enabled": true, "used": false}, {"email": "QuinlanJax5983@outlook.com", "password": "wi025467", "clientId": "9e5f94bc-e8a4-4e73-b8be-63364c29d753", "refreshToken": "M.C502_SN1.0.U.-CoplPw1V48DPrbK4iZMc8HFmXs*BHM8BPAEBtqOcQz!7HvG4orFfyH6sMDRvMjGwo8Ybtsj1URmD1QiGB*acIrZf4fRIjWnxCiODRXLl16F63boOcVsD66VlbDfcx2EcQkiTLz3DfP8lKGU*fYtBGxMabZ*MADoeD6jfTeNw7icrc4yAm*COI9xMCgZCFU2Xp2bSYUXxcJ3cLgXZRuLtFzlmoCmV!YENIThTOXXukc1KFBGUw03JAP2zrvGCUAS5W5xp82MSGyxIIYV9M4MXqVndXpDp1cky4OLEfPv3V6ERWaFwtriXhQ4xqLuia1hE0LkRVCB9tZS4vSOHSOoGMaNuUG365c3mZ5tfaNEQMxRxWrzdeIPNbOD5g1HsedxAOeMsp*5clyXUQioQSujc3vw$", "status": "authorized", "lastAuthAt": 1747850000000, "enabled": true, "used": false}, {"email": "LillianaAzaria2620@outlook.com", "password": "sl126442", "clientId": "9e5f94bc-e8a4-4e73-b8be-63364c29d753", "refreshToken": "M.C553_SN1.0.U.-CrWpFTmSsEU7gHs6TDkRQHASbod1vebDqi0XmKtMD5JYNCwpv9mtVnkVxJMpxiwXWk7ab7UAdZz01vH0KnLotBaHFeJEvjXnyp4EFKs5377xdfsiuAXFqBObO48TkothIIwyZqdhPOJ2szN0B0jQFA6954TDzhQ8mDHRJgiHDGpBHqz8qkY52fULUvZGk8GO!yWkeyZD0UusZJTgxcLBtnn*uLboONuPngCc6bEiCzJCLJyVlVeMithu*ngj*Hq0gmVBSz5cg*co8fwSLn1g6AO1l*hFnAk8N5RhHzPhPDEe8v2IChIxnE63YOqiAO6rcd7yCPk2H36fUy6hVGl5X1YilF644iTLzUWR8EI8SWIWA*A9r6YAWBW5myMJh3doOyTWEUtfaZnGh7XlSrG!g74$", "status": "authorized", "lastAuthAt": 1747850000000, "enabled": true, "used": false}, {"email": "MatthiasHallow6661@outlook.com", "password": "px268638", "clientId": "9e5f94bc-e8a4-4e73-b8be-63364c29d753", "refreshToken": "M.C505_SN1.0.U.-CttO6JVyBl6hHLCOAHhzEJ8EpcjOSWU!9kadtDNuilkbl8T3icWuFOWwXLv5eE*QWLHGHKFzS9EANAABNaDg32YJxqBI4dAPe*Kkgn0!puuH9tMduFBKWEn!!xVsZr!cvMrREm*MD27WUCTANB1ttaZTGUHEVSZNEKnqoTUDUKUSChrC8a1AcHGDkQxDPK1Zg7ilOeFBiRtHG0Y4FWzpdR3pXNwwUf1SGBJGYE1HX4HTSZKHaO4RR2DpwjWIIJ6AHsUfyiZ*O0fK5zMTsEWttGNzKH3WS2bKEkyc9dPC!N!LHjb2EoA8uwqZ2V8tGXx1hBfFr63VuEcHQI3uld7qwANEgJbqHp0Wl6WNNL4Bp8EWPJ*WTKhNN9DfpxZZCAhmoIxvYlHxsPcVmkQWMkSByjs$", "status": "authorized", "lastAuthAt": 1747850000000, "enabled": true, "used": false}];
    console.log('邮箱账号数:', accounts.length);

    // 注入配置
    console.log('注入配置...');
    const r1 = await Runtime.evaluate({
      expression: `
        (async () => {
          const accounts = ${JSON.stringify(hotmail_accounts)};
          await chrome.storage.local.set({
            panelMode: 'local-cpa-json-no-rt',
            accountAccessStrategy: 'local-cpa-json-no-rt',
            mailProvider: 'hotmail',
            hotmailAccounts: accounts,
            hotmailServiceMode: 'local',
            hotmailLocalBaseUrl: 'http://127.0.0.1:17373',
            accountRunHistoryHelperBaseUrl: 'http://127.0.0.1:17373',
            accountRunHistoryTextEnabled: true,
            phoneSmsProvider: '5sim',
            fiveSimApiKey: '$eyJhbGciOiJSUzUxMiIsInR5cCI6IkpXVCJ9.eyJleHAiOjE4MDk2MTkzNzcsImlhdCI6MTc3ODA4MzM3NywicmF5IjoiYjZiZjZkNzA3MmQxOGE1NGNiMDU3OGJjNDAyYTEwZDUiLCJzdWIiOjQwMzkyMDZ9.CB7bOxMvaKdDHL7sf1B4gpXVqUu7Ih97kxQziZ2OEiv3ohxMKIokAoFqBoCpRQ8TPKkwhGTVh8xLvXQxPzN41OGPYV5-xNYhCy1VzdfpJLXBI9YOu3QLOFrn45rxLzmrP7vscciNQswHbyW3-PDG-T3m6Z6kgU2boexSG7TXJp4HGyyL_keQ3t8_7GycArGKni40cWjR0Eispu4OER7Duun_u0Xl_rHctSdh_YAvIuGPb0HHN-MoSfPIF8doimVPH2Tp5GiqcaYYmcQjvMVWWx7Z5HcDFF0FheTDTv4Na_Bp-P4Vaaba4gy_dBQgjaMOAaazzr-WvrzVm5fkwQR6sg',
            fiveSimCountryId: 'argentina',
            fiveSimCountryLabel: 'Argentina',
            fiveSimProduct: 'openai',
            fiveSimOperator: 'any',
            fiveSimCountryOrder: ['argentina'],
            heroSmsApiKey: '$A7bbf4c81241bbA58fbbbbAA6853bd16',
            heroSmsCountryId: 39,
            heroSmsCountryLabel: 'Argentina',
            signupMethod: 'email',
            phoneVerificationEnabled: false,
            plusModeEnabled: false,
            localCpaJsonPluginDir: '/root/GuJumpgate/data/auth-output',
            localCpaJsonRelativeAuthDir: '.cli-proxy-api',
            autoRunSkipFailures: true,
            autoSkipFailures: true,
            freePhoneReuseEnabled: true,
            phoneSmsReuseEnabled: true,
            heroSmsReuseEnabled: true,
            accountRunHistory: []
          });
          return 'OK';
        })()
      `,
      awaitPromise: true,
      returnByValue: true
    });
    console.log('  注入结果:', r1.result.value);

    // 验证
    const rv = await Runtime.evaluate({
      expression: `
        (async () => {
          const d = await chrome.storage.local.get(['hotmailAccounts', 'mailProvider', 'plusModeEnabled']);
          const accounts = d.hotmailAccounts || [];
          const authorized = accounts.filter(a => a.status === 'authorized' && !a.used && a.refreshToken);
          return JSON.stringify({
            mailProvider: d.mailProvider,
            plusModeEnabled: d.plusModeEnabled,
            total: accounts.length,
            authorized: authorized.length,
            firstAuth: authorized[0] ? authorized[0].email : null
          });
        })()
      `,
      awaitPromise: true,
      returnByValue: true
    });
    console.log('  验证:', rv.result.value);

    // 启动AUTO_RUN
    console.log('\n启动AUTO_RUN...');
    const r2 = await Runtime.evaluate({
      expression: `
        (async () => {
          try {
            const response = await chrome.runtime.sendMessage({
              type: 'AUTO_RUN',
              source: 'sidepanel',
              payload: {
                totalRuns: 1,
                autoRunSkipFailures: true,
                mode: 'restart'
              }
            });
            return 'RESPONSE: ' + JSON.stringify(response);
          } catch(e) {
            return 'ERROR: ' + e.message;
          }
        })()
      `,
      awaitPromise: true,
      returnByValue: true
    });
    console.log('  结果:', r2.result.value);

    // 等待90秒
    console.log('\n等待90秒...');
    await new Promise(r => setTimeout(r, 90000));

    // 检查结果
    const r3 = await Runtime.evaluate({
      expression: `
        (async () => {
          const data = await chrome.storage.local.get(['accountRunHistory', 'hotmailAccounts']);
          const history = data.accountRunHistory || [];
          const accounts = data.hotmailAccounts || [];
          const used = accounts.filter(a => a.used);
          return JSON.stringify({
            runHistory: history.map(h => ({
              email: h.email || h.accountIdentifier,
              status: h.finalStatus,
              failedNode: h.failedNodeId,
              failureDetail: h.failureDetail ? h.failureDetail.substring(0, 150) : null,
              finishedAt: h.finishedAt
            })),
            usedAccounts: used.length,
            totalAccounts: accounts.length
          }, null, 2);
        })()
      `,
      awaitPromise: true,
      returnByValue: true
    });
    console.log('\n运行结果:');
    console.log(r3.result.value);

    // 检查页面
    const finalList = await getList();
    console.log('\n当前标签页:');
    finalList.filter(t => t.type === 'page').forEach(t => {
      console.log('  ' + t.title + ' -> ' + t.url.substring(0, 100));
    });

    // 检查auth-output
    const dir = '/root/GuJumpgate/data/auth-output';
    if (fs.existsSync(dir)) {
      const files = fs.readdirSync(dir);
      console.log('\nauth-output:', files.length > 0 ? files.join(', ') : '空');
    }

    await spClient.close();
  } catch(e) {
    console.error('ERR:', e.message);
  }
});