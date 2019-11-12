import React from "react";

export default class SymbolDropdown extends React.Component {
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