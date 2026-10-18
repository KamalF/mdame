use std::process::ExitCode;

use clap::Parser;
use mdame::app::Args;
use tracing::Level;

#[tokio::main]
async fn main() -> ExitCode {
    let args = Args::parse();
    let level = if args.verbose {
        Level::DEBUG
    } else {
        Level::INFO
    };
    tracing_subscriber::fmt().with_max_level(level).init();

    // Returning the error from main would print its Debug form.
    if let Err(error) = mdame::app::run(args).await {
        eprintln!("mdame: {error}");
        return ExitCode::FAILURE;
    }
    ExitCode::SUCCESS
}
