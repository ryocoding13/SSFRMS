import React,{useCallback,useEffect,useRef,useState} from "react";
import ConfirmDialog from "./ConfirmDialog.jsx";
const lowerFirst=text=>text.charAt(0).toLowerCase()+text.slice(1);
export const GENERIC_FAILURE="Chưa xác minh được kết quả. Giữ nội dung và kiểm tra trạng thái trước khi thử lại.";
export function changeFlowTexts({action,scope,successTitle,successText,failureTitle,failureText}) {return {confirmTitle:`${action}?`,successTitle:successTitle||`Đã ${lowerFirst(action)}`,successText:successText||`Thay đổi đã được ghi nhận. ${scope}.`,failureTitle:failureTitle||`Không ${lowerFirst(action)} được`,failureText:failureText||GENERIC_FAILURE};}
export function useChangeFlow() {
 const [state,setState]=useState(null),resolver=useRef(null),active=useRef(false),alive=useRef(true);
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;resolver.current?.(false);resolver.current=null;};},[]);
 const step=next=>!alive.current?Promise.resolve(false):new Promise(resolve=>{resolver.current=resolve;setState(next);});
 const answer=useCallback(value=>{const resolve=resolver.current;resolver.current=null;setState(null);resolve?.(value);},[]);
 const runChange=useCallback(async({action,scope,content,perform,confirm=true,danger=false,showSuccess=true,successAction="Về màn hình trước",...texts})=>{
  if(active.current||!alive.current)return {ok:false,cancelled:true};active.current=true;
  const t=changeFlowTexts({action,scope,...texts});
  try {
   if(confirm&&!(await step({kind:"confirm",danger,title:t.confirmTitle,rows:[["Thao tác",action],["Phạm vi",scope],["Nội dung",content]]})))return {ok:false,cancelled:true};
   if(!alive.current)return {ok:false,cancelled:true};setState({kind:"saving",title:"Đang lưu thay đổi",text:"Vui lòng chờ máy chủ xác nhận."});
   const result=await perform(()=>alive.current);
   if(!alive.current)return {ok:false,cancelled:true};setState(null);
   if(result===false)return {ok:false,cancelled:true};
   if(showSuccess)await step({kind:"success",title:t.successTitle,text:t.successText,action:successAction});
   return {ok:true,result};
  } catch(error) {
   const uncertain=Boolean(error?.uncertain||[0,409].includes(error?.status)||error?.status>=500);
   if(alive.current)await step({kind:"failure",title:t.failureTitle,text:uncertain?"Chưa xác minh được kết quả. Tải lại dữ liệu trước khi gửi tiếp.":t.failureText,detail:error?.message});
   return {ok:false,error,uncertain};
  } finally {active.current=false;}
 },[]);
 const element=state&&<ConfirmDialog title={state.title} tone={state.kind==="saving"?"info":state.kind==="confirm"&&state.danger?"danger":state.kind} busy={state.kind==="saving"} text={state.kind==="confirm"?"Kiểm tra thông tin trước khi xác nhận. Chọn Quay lại để giữ nguyên dữ liệu.":state.text} rows={state.kind==="confirm"?state.rows:[]} hint={state.kind==="confirm"?"Chỉ lưu thay đổi sau khi bạn bấm Xác nhận.":state.detail||""} cancelLabel={state.kind==="confirm"?"Quay lại":null} label={state.kind==="confirm"?"Xác nhận":state.kind==="success"?state.action:"Quay lại kiểm tra"} onCancel={()=>answer(false)} onConfirm={()=>answer(true)}/>;
 return [element,runChange];
}
export default useChangeFlow;
