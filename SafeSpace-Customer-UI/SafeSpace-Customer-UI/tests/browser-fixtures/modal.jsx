// Fixture chỉ dành cho Vite dev + Playwright, không nằm trong entry/bundle sản phẩm.
import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import {Button,Field,Modal} from '../../src/shared/components/UI.jsx';
import ReturnPhotoInput from '../../src/shared/components/ReturnPhotoInput.jsx';
import '../../src/shared/styles/customer-detail.css';
import SelectionPanel from '../../src/features/admin/components/SelectionPanel.jsx';
import '../../src/shared/styles/ss.css';
function Fixture(){
 const [open,setOpen]=useState(false),[panel,setPanel]=useState(false),[text,setText]=useState(''),[busy,setBusy]=useState(false),[photos,setPhotos]=useState([]);
 return <main style={{padding:24,minHeight:1800}}><Button onClick={()=>setOpen(true)}>Mở popup</Button><a href="#outside">Liên kết nền</a><ReturnPhotoInput files={photos} onChange={setPhotos} label="Ảnh kiểm thử"/>{open&&<Modal title="Kiểm tra focus" onClose={busy?undefined:()=>setOpen(false)}><Field label="Nội dung"><input value={text} onChange={e=>setText(e.target.value)}/></Field><Button onClick={()=>setPanel(true)}>Chọn cơ sở</Button><Button onClick={()=>setBusy(v=>!v)}>{busy?'Bỏ chờ':'Giả lập chờ'}</Button><fieldset disabled><Button>Không được focus</Button><select aria-label="Không được chọn"><option>Ẩn</option></select></fieldset><Button style={{display:'none'}}>Nút ẩn</Button><Button onClick={()=>setOpen(false)} disabled={busy}>Đóng popup</Button></Modal>}{panel&&<SelectionPanel title="Cơ sở kiểm thử" items={Array.from({length:40},(_,i)=>({id:i,label:`Cơ sở ${i+1}`,description:'Địa chỉ kiểm thử drawer'}))} onClose={()=>setPanel(false)} onSelect={()=>setPanel(false)}/>}</main>;
}
createRoot(document.getElementById('root')).render(<Fixture/>);
