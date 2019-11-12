import React from "react";

export default class AddSymbol extends React.Component {
    state = {
        loading: false,
        error: null,
        symbol: ""
    };

    async addSymbol() {
        const symbol = this.state.symbol;
        this.setState({loading: true, error: null, symbol: ""});
        try {
            const response = await fetch(`/symbol/${symbol}`, {method: "POST"});
            if (!response.ok) {
                this.setState({
                    loading: false,
                    error: response.statusText,
                });
                return;
            }

            this.setState({
                loading: false,
                error: null,
            });
        } catch (e) {
            this.setState({
                loading: false,
                error: e.toString(),
            });
        }
    }

    handleChange = (event) => {
        this.setState({symbol: event.target.value});
    };

    handleSubmit = () => {
        if (this.state.symbol) {
            this.addSymbol();
        }
    };

    render() {
        return (
            <div>
                <form onSubmit={this.handleSubmit}>
                    <input
                        type="text"
                        name="symbol"
                        value={this.state.symbol}
                        onChange={this.handleChange}
                        placeholder="Symbol..."
                    />
                    <button type="submit">Add Symbol</button>
                </form>
                {
                    this.state.error &&
                    <p>Error adding symbol: ${this.state.error}</p>
                }
                {
                    this.state.loading &&
                    <p>Adding symbol</p>
                }
            </div>
        );
    }
}