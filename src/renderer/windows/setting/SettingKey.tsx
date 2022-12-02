import { ChangeEvent, Component, FormEvent } from 'react';
import 'tailwindcss/tailwind.css';
import callApi from '../../lib/apis/ApiWrapper';

interface SettingKeyState {
    secretId: string | undefined;
    secretKey: string | undefined;
}
export default class SettingKey extends Component<any, SettingKeyState> {
    constructor(props: any) {
        super(props);
        this.state = {
            secretId: undefined,
            secretKey: undefined,
        };
    }

    async componentDidMount() {
        const newVar = (await callApi('get-secret', [])) as string[];
        this.setState({
            secretId: newVar[0],
            secretKey: newVar[1],
        });
    }

    private handleSecretIdChange = (event: ChangeEvent<HTMLInputElement>) => {
        this.setState({
            secretId: event.target.value,
        });
    };

    private handleSecretKeyChange = (event: ChangeEvent<HTMLInputElement>) => {
        this.setState({
            secretKey: event.target.value,
        });
    };

    private handleSubmit = async () => {
        const { secretKey, secretId } = this.state;
        await callApi('update-secret', [secretId, secretKey]);
        console.log(`A name was submitted: ${secretId}, ${secretKey}`);
    };

    render() {
        const { secretId, secretKey } = this.state;
        return (
            <div className="container mx-auto">
                <div className="flex flex-row flex-wrap py-4">
                    <aside className="w-1/3 select-none">
                        <div className="sticky top-0 p-4 w-full ">
                            <ul className="flex flex-col overflow-hidden bg-gray-100 shadow hover:bg-blue-500 py-1 px-5 rounded-lg">
                                密钥设置
                            </ul>
                        </div>
                    </aside>
                    <main role="main" className="w-2/3 pt-1 px-2 ">
                        <div className="w-full">
                            <form
                                className=" px-8 pt-6 pb-8 mb-4"
                                onSubmit={this.handleSubmit}
                            >
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
                                            onChange={this.handleSecretIdChange}
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
                                            onChange={
                                                this.handleSecretKeyChange
                                            }
                                        />
                                    </label>
                                </div>
                                <div className="flex items-center justify-end">
                                    <button
                                        className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline mr-5"
                                        onClick={this.handleSubmit}
                                        type="button"
                                    >
                                        Apply
                                    </button>
                                </div>
                            </form>
                        </div>
                    </main>
                </div>
            </div>
        );
    }
}
