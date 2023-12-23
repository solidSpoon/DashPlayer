// import TitleBar from '../../components/TitleBar/TitleBar';
// import { MdBuild, MdColorLens, MdKeyboard, MdOutlineGTranslate, MdStorage, MdTranslate } from 'react-icons/md';
// import React, { cloneElement, ReactElement } from 'react';
// import { Outlet, useLocation, useNavigate } from 'react-router-dom';
// import { SettingType } from './SettingRouter';
// import './SettingLayout.css';
//
// const Sidebar = () => {
//     const location = useLocation();
//     const navigate = useNavigate();
//     const ele = (name: string, key: SettingType, icon: ReactElement) => {
//         const isCurrent = location.pathname.includes(key);
//         return (
//             <ul
//                 onClick={() => navigate(`/${key}`)}
//                 className={`flex justify-start items-center overflow-hidden h-14 py-1 px-5 rounded-lg gap-4
//                             ${isCurrent ? 'bg-yellow-500' : ''}
//                             `}
//             >
//                 {cloneElement(icon, {
//                     className: `w-6 h-6 ${
//                         isCurrent ? 'fill-white' : 'fill-yellow-600'
//                     }`,
//                 })}
//                 {name}
//             </ul>
//         );
//     };
//     return (
//         <div className='p-4 pt-6 w-full h-full flex flex-col'>
//             {ele('快捷键', 'shortcut', <MdKeyboard />)}
//             {ele('外观', 'appearance', <MdColorLens />)}
//             {ele('字幕翻译', 'tenant', <MdOutlineGTranslate />)}
//             {ele('查单词', 'you-dao', <MdTranslate />)}
//             {ele('存储', 'storage', <MdStorage />)}
//             {ele('版本更新', 'update', <MdBuild />)}
//         </div>
//     )
// }
//
// const SettingLayout = () => {
//
//     let location = useLocation();
//     console.log(location.pathname);
//
//     return (
//         <div className="w-full h-screen flex flex-col mx-auto overflow-hidden select-none bg-stone-200">
//             <TitleBar
//                 maximizable={false}
//                 className="fixed top-0 left-0 w-full z-50"
//                 windowsButtonClassName="hover:bg-black/10 fill-black/50"
//                 autoHideOnMac={false}
//                 windowsHasSettings={false}
//             />
//             <div className="flex flex-1 h-0">
//                 <aside className="w-1/3 backdrop-blur-3xl pt-6">
//                     <Sidebar />
//                 </aside>
//                 <main
//                     role="main"
//                     className="w-0 flex-1 bg-stone-50 overflow-hidden pt-10"
//                 >
//                     <Outlet />
//                 </main>
//             </div>
//         </div>
//     )
// }
//
// export default SettingLayout;
