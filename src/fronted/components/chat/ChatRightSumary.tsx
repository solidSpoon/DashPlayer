// import {useEffect, useState} from "react";
// import useDpTask from "@/fronted/hooks/useDpTask";
// import {DpTask} from "@/backend/db/tables/dpTask";
//
// import {cn} from "@/fronted/lib/utils";
// import {strBlank} from "@/common/utils/Util";
// import SentenceT from "@/common/types/SentenceT";
// import usePlayerController from "@/fronted/hooks/usePlayerController";
// import {AiSummaryRes} from "@/common/types/AiSummaryRes";
// import Playable from "@/fronted/components/chat/Playable";
//
// const api = window.electron;
// const ChatRightSummary = ({ className}: {
//     className: string,
// }) => {
//
//     const res = usePlayerController(state => state.newSummary);
//
//     return (
//
//         <>
//             {!strBlank(res?.summary) && (
//                 <div>{res?.summary}</div>
//             )}
//             {
//                 !res && <div className="text-lg text-gray-700">生成总结中...</div>
//             }
//         </>
//
//     )
// }
//
// export default ChatRightSummary;
