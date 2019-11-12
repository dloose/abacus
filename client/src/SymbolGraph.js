import React from "react";
import Plot from "react-plotly.js";

export default class SymbolGraph extends React.Component {
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

        for (const {date, low, high, open, close, sma100d, rsi100d} of this.state.data) {
            candleStick.x.push(date);
            candleStick.low.push(low);
            candleStick.high.push(high);
            candleStick.open.push(open);
            candleStick.close.push(close);

            sma.x.push(date);
            sma.y.push(sma100d);

            rsi.x.push(date);
            rsi.y.push(rsi100d);
        }

        return (
            <div>
                <Plot
                    data={[candleStick, sma]}
                    layout={{title: this.props.symbol}}
                />
                <Plot
                    data={[rsi]}
                    layout={{title: `${this.props.symbol} RSI`, yaxis: {range: [0, 100]}}}
                />
            </div>
        );
    }
}