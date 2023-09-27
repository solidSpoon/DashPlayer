import { ChangeEvent, useEffect, useState } from 'react';
import callApi from '../../../lib/apis/ApiWrapper';

const TenantSetting = () => {
    const [secretId, setSecretId] = useState<string | undefined>();
    const [secretKey, setSecretKey] = useState<string | undefined>();
    const [serverValue, serServerValue] = useState<string[] | undefined>();

    const eqServer =
        serverValue?.[0] === secretId && serverValue?.[1] === secretKey;
    const updateFromServer = async () => {
        const newVar = (await callApi('get-you-dao-secret', [])) as string[];
        if (newVar.length === 0) {
            return;
        }
        setSecretId(newVar[0]);
        setSecretKey(newVar[1]);
        serServerValue(newVar);
    };
    useEffect(() => {
        updateFromServer();
    }, []);

    const handleSecretIdChange = (event: ChangeEvent<HTMLInputElement>) => {
        setSecretId(event.target.value);
    };

    const handleSecretKeyChange = (event: ChangeEvent<HTMLInputElement>) => {
        setSecretKey(event.target.value);
    };

    const handleSubmit = async () => {
        await callApi('update-you-dao-secret', [secretId, secretKey]);
        await updateFromServer();
        console.log(`A name was submitted: ${secretId}, ${secretKey}`);
    };
    return (
        <div className="w-full">
            <form className=" px-8 pt-6 pb-8 mb-4" onSubmit={handleSubmit}>
                <h1 className="text-2xl font-bold mb-2">有道密钥</h1>
                <div className="mb-4">
                    <label
                        className="block text-gray-700 text-sm font-bold mb-2 select-none"
                        htmlFor="secretId"
                    >
                        secretId
                        <input
                            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 mb-3 mt-2 leading-tight focus:outline-none focus:shadow-outline"
                            id="secretId"
                            type="text"
                            // placeholder="******************"
                            value={secretId || ''}
                            onChange={handleSecretIdChange}
                        />
                    </label>
                </div>
                <div className="mb-6">
                    <label
                        className="block text-gray-700 text-sm font-bold mb-2 select-none"
                        htmlFor="password"
                    >
                        secretKey
                        <input
                            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 mb-3 mt-2 leading-tight focus:outline-none focus:shadow-outline"
                            id="password"
                            type="password"
                            placeholder="******************"
                            value={secretKey || ''}
                            onChange={handleSecretKeyChange}
                        />
                    </label>
                </div>
                <div className="flex items-center justify-end">
                    <button
                        className="text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline mr-5 disabled:bg-gray-500 bg-blue-500 hover:bg-blue-700"
                        onClick={handleSubmit}
                        disabled={eqServer}
                        type="button"
                    >
                        Apply
                    </button>
                </div>
            </form>
        </div>
    );
};
export default TenantSetting;
