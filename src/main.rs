#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    mdame::app::run().await
}
