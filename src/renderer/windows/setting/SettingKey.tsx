import { ChangeEvent, Component, FormEvent } from 'react';
import 'tailwindcss/tailwind.css';

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

    private handleChange = (event: ChangeEvent<HTMLInputElement>) => {
        this.setState({
            secretId: event.target.value,
            secretKey: event.target.value,
        });
    };

    private handleSubmit = (event: FormEvent<HTMLFormElement>) => {
        const { secretKey, secretId } = this.state;
        console.log(`A name was submitted: ${secretId}, ${secretKey}`);
    };

    render() {
        return (
            <>
                <div className="text-center border-solid border-4 border-red-500 bg-black text-white shadow">
                    ERB + TAILWIND = ❤
                </div>
                <form onSubmit={this.handleSubmit}>
                    <label htmlFor="secretId">
                        secretId:
                        <input type="text" onChange={this.handleChange} />
                    </label>
                    <label htmlFor="secretKey">
                        secretKey:
                        <input type="text" onChange={this.handleChange} />
                    </label>
                    <input type="submit" value="Submit" />
                </form>
            </>
        );
    }
}
