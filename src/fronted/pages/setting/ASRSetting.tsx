import FooterWrapper from "@/fronted/components/setting/FooterWrapper";
import Header from "@/fronted/components/setting/Header";
import ItemWrapper from "@/fronted/components/setting/ItemWrapper";
import SettingInput from "@/fronted/components/setting/SettingInput";
import { Button } from "@/fronted/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/fronted/components/ui/dropdown-menu";
import { Label } from "@/fronted/components/ui/label";
import useSettingForm from "@/fronted/hooks/useSettingForm";
import { cn } from "@/fronted/lib/utils";
import { EllipsisVertical } from "lucide-react";

const api = window.electron;
const ASRSetting = () => {
    const { setting, setSettingFunc, submit, eqServer } = useSettingForm([
        "asr.provider",
        "asr.spark.appId",
        "asr.spark.secretKey",
    ]);

    return (
        <form className="w-full h-full flex flex-col gap-4">
            <Header
                title="语音识别"
                description="配置语音识别接口，支持科大讯飞接口"
            />
            <ItemWrapper>
                <div className={"flex justify-start items-end gap-2"}>
                    <SettingInput
                        className={cn("w-fit")}
                        type="text"
                        inputWidth="w-64"
                        placeHolder="openai"
                        setValue={setSettingFunc("asr.provider")}
                        title="Provider"
                        value={setting("asr.provider")}
                    />
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button
                                className={"mb-1.5"}
                                variant={"outline"}
                                size={"icon"}
                            >
                                <EllipsisVertical />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                            <DropdownMenuItem
                                onClick={() => {
                                    setSettingFunc("asr.provider")("openai");
                                }}
                            >
                                Openai
                            </DropdownMenuItem>
                            <DropdownMenuItem
                                onClick={() => {
                                    setSettingFunc("asr.provider")("spark");
                                }}
                            >
                                讯飞语音
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
                <div className="flex flex-col gap-5 pl-2">
                    <Label>讯飞语音配置</Label>
                    <SettingInput
                        setValue={setSettingFunc("asr.spark.appId")}
                        title="应用AppID"
                        placeHolder="应用AppID"
                        inputWidth="w-64"
                        value={setting("asr.spark.appId")}
                    />
                    <SettingInput
                        setValue={setSettingFunc("asr.spark.secretKey")}
                        title="应用SecretKey"
                        placeHolder="******************"
                        inputWidth="w-64"
                        type="password"
                        value={setting("asr.spark.secretKey")}
                    />
                </div>
            </ItemWrapper>
            <FooterWrapper>
                <Button disabled={eqServer} onClick={submit}>
                    Apply
                </Button>
            </FooterWrapper>
        </form>
    );
};
export default ASRSetting;
