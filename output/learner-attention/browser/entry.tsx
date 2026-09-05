import React from 'react';
import { getThinkfyWebCssVariables } from '@thinkfy/shared/design-system';
import {createRoot} from 'react-dom/client';
import { ParentBandReportScreen } from '../../../apps/web/src/components/ielts/parent-report/report-screen';
import { ClassAnalyticsPanel } from '../../../apps/web/src/components/analytics/ClassAnalyticsPanel';
import { PageContainer } from '../../../apps/web/src/components/shared/product-layout';
import { parseFollowupContext, attentionDays } from '../../../apps/web/src/lib/analytics/learner-followup-navigation';
import { input,parent,getParentBandReport,exportParentBandReport } from './fixture';
const query=new URLSearchParams(location.search);
const locale=location.pathname.startsWith('/vi/')?'vi':'en';
const studentId=location.pathname.split('/reports/')[1]??input.rows[0].userId;
const isReport=location.pathname.includes('/reports/');
document.documentElement.classList.toggle('dark',localStorage.getItem('qa-theme')==='dark');
Object.entries(getThinkfyWebCssVariables(document.documentElement.classList.contains('dark')?'dark':'light')).forEach(([key,value])=>document.documentElement.style.setProperty(key,String(value)));
document.documentElement.style.setProperty('--font-inter','Inter');
function App(){return <><div style={{padding:12}}><strong>SYNTHETIC QA · assigned worktree 4238</strong> <button onClick={()=>{localStorage.setItem('qa-theme',document.documentElement.classList.contains('dark')?'light':'dark');location.reload()}}>Toggle QA theme</button></div>{isReport?<ParentBandReportScreen initialReport={parent(studentId,query.get('month')??undefined)} locale={locale} roster={{classId:input.classId,className:input.classTitle,timeZone:input.period.timezone,students:input.rows.map(row=>({id:row.userId,name:row.displayName}))}} followupContext={parseFollowupContext(Object.fromEntries(query))} getReport={getParentBandReport} exportReport={exportParentBandReport}/>:<PageContainer size="wide"><ClassAnalyticsPanel classId={input.classId} locale={locale} initialDays={attentionDays(query.get('attentionDays')??undefined)}/></PageContainer>}</>}
createRoot(document.getElementById('root')!).render(<App/>);
