use std::cmp::Ordering;
use std::fmt;
use std::str::FromStr;

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub struct Version {
    pub major: u32,
    pub minor: u32,
    pub build: u32,
}

impl Version {
    pub fn new(major: u32, minor: u32, build: u32) -> Self {
        Self { major, minor, build }
    }
}

impl Ord for Version {
    fn cmp(&self, other: &Self) -> Ordering {
        match self.major.cmp(&other.major) {
            Ordering::Equal => match self.minor.cmp(&other.minor) {
                Ordering::Equal => self.build.cmp(&other.build),
                other => other,
            },
            other => other,
        }
    }
}

impl PartialOrd for Version {
    fn partial_cmp(&self, other: &Self) -> Option<Ordering> {
        Some(self.cmp(other))
    }
}

impl FromStr for Version {
    type Err = String;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        let parts: Vec<&str> = s.split('.').collect();
        if parts.len() != 3 {
            return Err(format!("invalid version format: expected MAJOR.MINOR.BUILD, got {}", s));
        }

        let major = parts[0]
            .parse::<u32>()
            .map_err(|_| format!("invalid major version: {}", parts[0]))?;
        let minor = parts[1]
            .parse::<u32>()
            .map_err(|_| format!("invalid minor version: {}", parts[1]))?;
        let build = parts[2]
            .parse::<u32>()
            .map_err(|_| format!("invalid build version: {}", parts[2]))?;

        Ok(Self { major, minor, build })
    }
}

impl fmt::Display for Version {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}.{}.{}", self.major, self.minor, self.build)
    }
}
