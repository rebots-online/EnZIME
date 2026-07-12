// Tokenizer trait for encoding/decoding text to/from token IDs

pub trait Tokenizer {
    fn encode(&self, text: &str) -> Vec<u32>;
    fn decode(&self, tokens: &[u32]) -> String;
}

/// SentencePiece-based tokenizer implementation
pub struct SentencePieceTokenizer {
    pub sp: sentencepiece::SentencePieceProcessor,
}

impl Tokenizer for SentencePieceTokenizer {
    fn encode(&self, text: &str) -> Vec<u32> {
        self.sp
            .encode(text)
            .map(|ids| ids.into_iter().map(|id| id as u32).collect())
            .unwrap_or_default()
    }

    fn decode(&self, tokens: &[u32]) -> String {
        let ids: Vec<u32> = tokens.to_vec();
        self.sp
            .decode(&ids)
            .unwrap_or_default()
    }
}
