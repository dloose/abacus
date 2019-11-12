import Plot from "react-plotly.js";
import React from "react";

class SymbolDropdown extends React.Component {
    state = {
        loading: false,
        error: null,
        symbols: null
    };

    async loadSymbols() {
        this.setState({loading: true, error: null});
        try {
            const response = await fetch("/symbol");
            if (!response.ok) {
                this.setState({
                    loading: false,
                    error: response.statusText,
                    symbols: null
                });
                return;
            }

            const symbols = await response.json();
            symbols.sort((a, b) => a.symbol.localeCompare(b.symbol));

            this.setState({
                loading: false,
                error: null,
                symbols
            });
        } catch (e) {
            this.setState({
                loading: false,
                error: e.toString(),
                symbols: null
            });
        }
    }

    componentDidMount() {
        this.loadSymbols();
    }

    handleChange = (event) => {
        this.props.onSymbolChange(event.target.value);
    };

    render() {
        if (this.state.error) {
            return (
                <div>
                    <p>Error loading symbols: ${this.state.error}</p>
                </div>
            );
        }
        if (this.state.loading || this.state.symbols === null) {
            return (
                <div>
                    <p>Loading symbols</p>
                </div>
            );
        }

        return (
            <div>
                <select name="symbols" onChange={this.handleChange} value={this.props.selectedSymbol || ""}>
                    <optgroup label="Available">{
                        this.state.symbols
                            .filter(({initial_import_date}) => !!initial_import_date)
                            .map(({symbol}) => (
                                <option key={symbol} value={symbol}>{symbol}</option>
                            ))
                    }</optgroup>
                    <optgroup label="Still importing...">{
                        this.state.symbols
                            .filter(({initial_import_date}) => !initial_import_date)
                            .map(({symbol}) => (
                                <option key={symbol} value={symbol} disabled>{symbol}</option>
                            ))
                    }</optgroup>
                </select>
            </div>
        );
    }
}

class AddSymbol extends React.Component {
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
                    <button type="submit" >Add Symbol</button>
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

class SymbolGraph extends React.Component {
    state = {
        loadingSymbol: null,
        error: null,
        data: null
    };

    async loadSymbolData() {
        this.setState({loadingSymbol: this.props.symbol, error: null});
        try {
            const response = await fetch(`/symbol/${this.props.symbol}`);
            if (!response.ok) {
                this.setState({
                    loadingSymbol: null,
                    error: response.statusText,
                    data: null
                });
                return;
            }

            const data = await response.json();
            this.setState({
                loadingSymbol: null,
                error: null,
                data: data.data
            });
        } catch (e) {
            this.setState({
                loadingSymbol: null,
                error: e.toString(),
                data: null
            });
        }
    }

    componentDidMount() {
        if (this.props.symbol) {
            this.loadSymbolData();
        }
    }

    componentDidUpdate(prevProps) {
        if (this.props.symbol &&
            prevProps.symbol !== this.props.symbol &&
            this.state.loadingSymbol !== this.props.symbol) {
            this.loadSymbolData();
        }
    }

    render() {
        if (!this.props.symbol) {
            return (
                <div>
                    <p>No symbol selected</p>
                </div>
            );
        }
        if (this.state.error) {
            return (
                <div>
                    <p>Error loading data {this.props.symbol}</p>
                </div>
            );
        }
        if (this.state.loadingSymbol || this.state.data === null) {
            return (
                <div>
                    <p>Loading data for {this.state.loadingSymbol}</p>
                </div>
            );
        }

        // {"low":192.58,"date":"2019-08-05","high":198.65,"open":197.99,"close":193.34,"symbol":"AAPL","rsi100d":"NaN","sma100d":"NaN"}
        const candleStick = {
            type: "candlestick",
            name: "Daily",
            xaxis: "x",
            yaxis: "y",
            x: [],
            low: [],
            high: [],
            open: [],
            close: []
        };

        const sma = {
            type: "lines+markers",
            name: "SMA (100 days)",
            x: [],
            y: []
        };

        const rsi = {
            type: "lines+markers",
            name: "RSI (100 days)",
            x: [],
            y: []
        };

        for (const {date, low, high, open, close, sma100d} of this.state.data) {
            candleStick.x.push(date);
            candleStick.low.push(low);
            candleStick.high.push(high);
            candleStick.open.push(open);
            candleStick.close.push(close);

            sma.x.push(date);
            sma.y.push(sma100d);
        }

        return (
            <div>
                <Plot
                    data={[candleStick, sma]}
                    layout={{title: this.props.symbol}}
                />
                <Plot
                    data={[rsi]}
                    layout={{title: this.props.symbol}}
                />
            </div>
        );
    }
}

export default class App extends React.Component {
    state = {
        newSymbol: "",
        selectedSymbol: null,
    };

    handleSymbolChange = (selectedSymbol) => {
        this.setState({selectedSymbol});
    };

    render() {
        return (
            <div className="App">
                <SymbolDropdown selectedSymbol={this.state.selectedSymbol} onSymbolChange={this.handleSymbolChange}/>
                <SymbolGraph symbol={this.state.selectedSymbol}/>
                <AddSymbol/>
            </div>
        );
    }
}