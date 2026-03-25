import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  errorInfo: string | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  public state: State = {
    hasError: false,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, errorInfo: error.message };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      let displayMessage = 'Ocorreu um erro inesperado.';
      
      try {
        const parsedError = JSON.parse(this.state.errorInfo || '');
        if (parsedError.error && parsedError.error.includes('insufficient permissions')) {
          displayMessage = 'Você não tem permissão para realizar esta operação. Verifique as regras do Firestore.';
        }
      } catch (e) {
        // Not a JSON error
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-black p-6">
          <div className="max-w-md w-full bg-[#111] border border-red-900/30 rounded-2xl p-8 text-center">
            <div className="h-16 w-16 bg-red-900/20 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Ops! Algo deu errado</h2>
            <p className="text-gray-400 mb-8">{displayMessage}</p>
            <button
              onClick={() => window.location.reload()}
              className="w-full bg-white text-black font-semibold py-3 rounded-lg hover:bg-gray-200 transition-all"
            >
              Recarregar Página
            </button>
          </div>
        </div>
      );
    }

    return (this as any).props.children;
  }
}
