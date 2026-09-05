import { classFixture, uuid } from '../../../apps/web/src/lib/analytics/__fixtures__/analytics';
import { buildClassAnalytics } from '../../../apps/web/src/lib/analytics/class-rollup';
import { createParentReportFixture } from '../../../apps/web/src/lib/ielts/parent-report/fixtures';
export const input = classFixture(2);
input.rows[0].displayName = 'Nguyễn Hoàng Minh Anh – Học viên kiểm thử';
input.rows[1].displayName = 'Trần Nguyễn Phương Thảo – Học viên kiểm thử';
const overdue = structuredClone(input.rows[0].assignments[0]);
overdue.assignmentId=uuid(99); overdue.title='Bài tập luyện viết: Phân tích nguyên nhân và đề xuất giải pháp cho vấn đề môi trường'; overdue.submittedAt=null; overdue.attemptId=null; overdue.reviewTargets=[]; overdue.homework.submitted=false; overdue.homework.submittedAt=null; overdue.homework.score=null; overdue.score.overall=null; overdue.dueAt='2026-09-01T00:00:00Z'; overdue.status='active';
input.rows[0].assignments.unshift(overdue);
export const analytics = buildClassAnalytics(input);
export async function getClassAnalyticsAction({ days }: any) { return {ok:true,data:{...analytics,period:{...analytics.period,days}}}; }
let failed=false;
export async function getLearnerFollowupAction({ studentId, days }: any) {
  const scenario = new URLSearchParams(location.search).get('fixture');
  await new Promise(resolve=>setTimeout(resolve,scenario==='loading'?3000:300));
  if(scenario==='unavailable' && !failed){ failed=true; return {ok:false,error:'unavailable'}; }
  if(scenario==='forbidden') return {ok:false,error:'forbidden'};
  const row=input.rows.find(row=>row.userId===studentId)!;
  const empty=scenario==='empty';
  return {ok:true,data:{ classId:input.classId,clubId:input.clubId,studentId,displayName:row.displayName,classTitle:input.classTitle,period:{...input.period,days}, reasons:empty?[]:analytics.attention.find(item=>item.learnerId===studentId)?.reasons??[],assignments:empty?[]:row.assignments,sources:{subskills:scenario==='partial'?'unavailable':'available'},attendance:empty?[]:[{date:'2026-09-02',status:'absent'},{date:'2026-09-04',status:'absent'}],weaknesses:empty?[]:[{label:{en:'Linking ideas with supporting evidence',vi:'Liên kết ý tưởng với bằng chứng hỗ trợ'},lastEvidenceAt:'2026-09-02T02:00:00Z',evidenceCount:4,severity:0.8}]}};
}
export function parent(studentId:string,month='2026-08') { const report=createParentReportFixture();report.context.classId=input.classId;report.context.clubId=input.clubId;report.context.studentId=studentId;report.context.studentName=input.rows.find(row=>row.userId===studentId)?.displayName??'Unknown';report.period.month=month;return report; }
export const getParentBandReport=async({studentId,month}:any)=>parent(studentId,month);
export const exportParentBandReport=async()=>{throw Error('Export disabled in isolated browser QA')};
export const exportPostMockReportAction=exportParentBandReport;
