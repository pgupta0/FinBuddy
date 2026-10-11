// Requires a local dev server and Playwright. All answer/model responses are mocked.
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const base = process.env.FINBUDDY_TEST_URL || 'http://localhost:3000';
if (!['localhost','127.0.0.1'].includes(new URL(base).hostname)) throw Error('Offline test requires localhost');
const output = path.resolve('docs/ui-evaluation-results.json');
const screenshotDir = process.env.FINBUDDY_SCREENSHOT_DIR;
const models = { enabled:true, current:{vendor:'anthropic',modelId:'mock-anthropic'}, models:[
  {vendor:'anthropic',vendorLabel:'Anthropic',modelId:'mock-anthropic',label:'Mock Anthropic',tier:'economy',isVendorDefault:true},
  {vendor:'google',vendorLabel:'Gemini',modelId:'mock-gemini',label:'Mock Gemini',tier:'economy',isVendorDefault:true}] };
const report={ mode:'offline mocked UI; not model quality or real-user research', checks:[], externalRequestsBlocked:0, mockChatRequests:0, browserErrors:[] };
function assert(ok, label) { if(!ok)throw Error(label); report.checks.push({label,passed:true}); }
function stream(mode) {
  const data=[{type:'start',messageId:'mock-'+Date.now()},{type:'text-start',id:'t'},{type:'text-delta',id:'t',delta:'Mock lesson: investments can lose value. Educational information only, not investment advice.'},{type:'text-end',id:'t'},
    {type:'data-sources',data:[{kind:'kb',title:'Mock primary source',url:'https://example.org/education',site:'Mock corpus',number:1},{kind:'web',title:'Unsafe URL fixture',url:'javascript:alert(1)',site:'Adversarial fixture',number:2}]}];
  if(mode!=='pending')data.push({type:'data-compliance',data:{label:mode==='withheld'?'RED':'GREEN',withheld:mode==='withheld',appendDisclaimer:false}});
  data.push({type:'finish'});return data.map(v=>'data: '+JSON.stringify(v)+'\n\n').join('')+'data: [DONE]\n\n';
}
(async()=>{
  const browser=await chromium.launch({channel:process.env.FINBUDDY_BROWSER_CHANNEL||'msedge',headless:true});
  const context=await browser.newContext();let mode='approved';const calls=[];
  await context.route('**/*', async r=>{const u=new URL(r.request().url());if(u.origin!==new URL(base).origin){report.externalRequestsBlocked++;return r.abort();}if(u.pathname==='/api/models')return r.fulfill({json:models});if(u.pathname==='/api/chat'){report.mockChatRequests++;calls.push({headers:r.request().headers(),body:r.request().postDataJSON()});return r.fulfill({status:200,contentType:'text/event-stream',headers:{'x-vercel-ai-ui-message-stream':'v1'},body:stream(mode)});}if(u.pathname==='/api/feedback')return r.fulfill({json:{ok:true}});return r.continue();});
  const page=await context.newPage();page.on('pageerror',e=>report.browserErrors.push(e.message));
  for(const [width,height] of [[1366,768],[768,1024],[390,844],[320,568],[844,390]]){
    await page.setViewportSize({width,height});await page.goto(base,{waitUntil:'networkidle'});
    for(const theme of ['light','dark']){
      await page.evaluate(t=>{document.documentElement.classList.toggle('dark',t==='dark');},theme);await page.waitForTimeout(100);
      const geometry=await page.evaluate(()=>{const cards=[...document.querySelectorAll('.welcome-card')];const area=cards[0]?.closest('.overflow-y-auto');return { overflow:document.documentElement.scrollWidth>innerWidth,cards:cards.length,hidden:cards.some(e=>{const r=e.getBoundingClientRect();return r.x<0||r.right>innerWidth}),scroll:area?area.scrollHeight-area.clientHeight:0 };});
      assert(!geometry.overflow && !geometry.hidden && geometry.cards===6,'six cards fit horizontally '+width+'x'+height+' '+theme);
      if(height>=568)assert(geometry.scroll<=2,'homepage needs no content scroll '+width+'x'+height+' '+theme);
      if(screenshotDir){fs.mkdirSync(screenshotDir,{recursive:true});await page.screenshot({path:path.join(screenshotDir,'finbuddy-eval-'+width+'-'+theme+'.png')});}
    }
  }
  await page.setViewportSize({width:390,height:844});await page.goto(base,{waitUntil:'networkidle'});
  const button=n=>page.getByRole('button',{name:n,exact:true});
  await button('Change model').click();await page.getByRole('menuitemradio',{name:/Mock Gemini/}).click();
  await page.getByRole('button',{name:/I’m new to investing/}).click();await page.getByRole('dialog').waitFor();assert(calls.length===0,'onboarding has zero chat/API calls');
  assert(await button('Next').isDisabled(),'onboarding requires an explicit answer');
  for(const n of ['I’m starting from scratch','How SIPs work','Hinglish']){await page.getByRole('radio',{name:n,exact:true}).check();await button('Next').click();}
  await page.getByRole('radio',{name:'One clear example'}).check();await page.getByRole('checkbox').check();await button('Use these preferences').click();await page.waitForTimeout(600);
  assert(calls.length===1 && calls[0].headers['x-model-id']==='mock-gemini','model selection reaches request');
  const pref=JSON.parse(calls[0].headers['x-learner-preferences']);assert(pref.goal==='sip'&&pref.language==='hinglish'&&JSON.stringify(calls[0].body).includes('Explain what a SIP is'),'profile shapes the first lesson request');
  assert(await page.getByText('Mock lesson:',{exact:false}).count()>0,'approved mock answer displays');
  await page.getByRole('button',{name:'Sources (2)',exact:true}).click();assert(await page.locator('a[href^="javascript:"]').count()===0,'unsafe source URL is not clickable');
  await button('Learning preferences').click();const downloaded=page.waitForEvent('download');await button('Export profile .md').click();assert((await downloaded).suggestedFilename()==='finbuddy-learning-profile.md','Markdown profile exports');await page.keyboard.press('Escape');
  await page.reload({waitUntil:'networkidle'});await button('Learning preferences').click();assert(await page.getByRole('radio',{name:'I’m starting from scratch'}).isChecked(),'opted-in preferences survive reload');await button('Delete preferences').click();
  assert((await page.evaluate(()=>Object.keys(localStorage).filter(k=>k.startsWith('finbuddy-learning-')))).length===0,'delete removes remembered profile');
  await button('New chat').click();await page.getByRole('button',{name:/I’m new to investing/}).click();assert(!(await page.getByRole('radio',{name:'I’m starting from scratch'}).isChecked()),'new chat has no prior profile');await button('Skip').click();await page.waitForTimeout(500);assert(!calls.at(-1).headers['x-learner-preferences'],'skip sends no saved profile');
  for(const review of ['pending','withheld']){mode=review;await button('New chat').click();await page.getByRole('button',{name:/How does a SIP work/}).click();await page.waitForTimeout(500);assert(await page.getByText('Mock lesson:',{exact:false}).count()===0,'draft hidden when '+review);assert(await page.getByRole('button',{name:'Sources (2)',exact:true}).count()===0,'draft sources hidden when '+review);}
  assert(report.browserErrors.length===0,'no browser runtime errors');await browser.close();report.passed=true;fs.writeFileSync(output,JSON.stringify(report,null,2));console.log(JSON.stringify({passed:true,checks:report.checks.length,mockedChatRequests:report.mockChatRequests,report:output}));
})().catch(e=>{report.passed=false;report.failure=e.message;fs.writeFileSync(output,JSON.stringify(report,null,2));console.error(e);process.exit(1)});
