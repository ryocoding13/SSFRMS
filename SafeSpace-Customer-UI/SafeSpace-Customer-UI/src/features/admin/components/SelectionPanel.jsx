/**
 * SELECTION PANEL - KHUNG HỘP THOẠI CHỌN ĐƠN MỤC DẠNG NGĂN KÉO (DRAWER)
 *
 * Dùng cho các luồng quản trị (Admin):
 * - Chọn vai trò khi đổi vai trò hoặc cấp lại vai trò.
 * - Chọn cơ sở phụ trách từ danh mục cơ sở đang hoạt động.
 * Đảm bảo người dùng chỉ chọn từ danh mục chuẩn xác thực, không nhập text tự do.
 */
import React,{useState} from "react";
import { Button,Empty,Modal } from "../../../shared/components/UI.jsx";
import "./admin-selection.css";
/**
 * Component hiển thị ngăn kéo chọn lựa chọn đơn mục với thông tin mô tả chi tiết.
 * @param {{ title: string, description: string, items: Array, value: any, onClose: Function, onSelect: Function, confirmLabel?: string, disabled?: boolean }} props
 */
export default function SelectionPanel({title,description,items,value,onClose,onSelect,confirmLabel="Dùng lựa chọn này",disabled=false}) {
 const [chosen,setChosen]=useState(value==null?"":String(value)),selected=items.find(i=>String(i.id)===chosen);
 return <Modal title={title} size="selection" placement="drawer" onClose={disabled?undefined:onClose}><Button className="selection-panel__close" variant="outline" disabled={disabled} onClick={onClose}>Đóng</Button><p className="hint">{description}</p><div className="selection-panel__selected"><span className="hint">Đã chọn</span><strong>{selected?.label||"Chưa chọn"}</strong></div><div className="selection-panel__list">{items.map(i=><button type="button" key={i.id} className="selection-panel__item" aria-pressed={chosen===String(i.id)} disabled={disabled||i.disabled} onClick={()=>setChosen(String(i.id))}><span><strong>{i.label}</strong>{i.description&&<small>{i.description}</small>}</span><span>{i.disabled?"Đang có":chosen===String(i.id)?"Đã chọn":"Chọn"}</span></button>)}{!items.length&&<Empty title="Chưa có lựa chọn phù hợp" text="Thử tải lại danh sách."/>}</div><Button block disabled={disabled||!selected||selected.disabled} onClick={()=>onSelect(selected.id)}>{confirmLabel}</Button></Modal>;
}
