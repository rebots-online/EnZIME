//! Terminal User Interface (TUI) for ZIM Downloader
//! 
//! Uses ratatui for rendering and crossterm for terminal handling.

use anyhow::Result;
use crossterm::{
    event::{self, DisableMouseCapture, EnableMouseCapture, Event, KeyCode, KeyEventKind},
    execute,
    terminal::{disable_raw_mode, enable_raw_mode, EnterAlternateScreen, LeaveAlternateScreen},
};
use ratatui::{
    backend::CrosstermBackend,
    Terminal,
};
use std::io;
use std::time::Duration;

use crate::ui::{App, AppResult};

/// Run the TUI application
pub fn run_tui() -> Result<()> {
    // Setup terminal
    enable_raw_mode()?;
    let mut stdout = io::stdout();
    execute!(stdout, EnterAlternateScreen, EnableMouseCapture)?;
    let backend = CrosstermBackend::new(stdout);
    let mut terminal = Terminal::new(backend)?;

    // Create app and run it
    let app = App::new()?;
    let res = run_app(&mut terminal, app);

    // Restore terminal
    disable_raw_mode()?;
    execute!(
        terminal.backend_mut(),
        LeaveAlternateScreen,
        DisableMouseCapture
    )?;
    terminal.show_cursor()?;

    if let Err(err) = res {
        println!("Error: {:?}", err);
    }

    Ok(())
}

/// Main application loop
fn run_app<B: ratatui::backend::Backend>(
    terminal: &mut Terminal<B>,
    mut app: App,
) -> AppResult<()> {
    // Initialize async runtime for the TUI
    let rt = tokio::runtime::Runtime::new()?;
    
    // Initial data fetch
    rt.block_on(async {
        app.fetch_repositories().await;
        if let Some(repo) = app.repositories.first() {
            app.current_repo = Some(repo.id.clone());
            app.fetch_zim_list().await;
        }
    });

    loop {
        // Draw UI
        terminal.draw(|f| crate::ui::draw(f, &mut app))?;

        // Handle input with timeout for updates
        if event::poll(Duration::from_millis(100))? {
            if let Event::Key(key) = event::read()? {
                if key.kind == KeyEventKind::Press {
                    match app.input_mode {
                        crate::ui::InputMode::Normal => {
                            match key.code {
                                KeyCode::Char('q') => return Ok(()),
                                KeyCode::Char('?') | KeyCode::F(1) => {
                                    app.show_help = !app.show_help;
                                }
                                KeyCode::Tab => {
                                    app.next_tab();
                                }
                                KeyCode::BackTab => {
                                    app.previous_tab();
                                }
                                KeyCode::Down | KeyCode::Char('j') => {
                                    app.next_item();
                                }
                                KeyCode::Up | KeyCode::Char('k') => {
                                    app.previous_item();
                                }
                                KeyCode::Enter => {
                                    rt.block_on(async {
                                        app.select_item().await;
                                    });
                                }
                                KeyCode::Char('d') => {
                                    rt.block_on(async {
                                        app.start_download().await;
                                    });
                                }
                                KeyCode::Char('p') => {
                                    rt.block_on(async {
                                        app.pause_download().await;
                                    });
                                }
                                KeyCode::Char('r') => {
                                    rt.block_on(async {
                                        app.resume_download().await;
                                    });
                                }
                                KeyCode::Char('c') => {
                                    rt.block_on(async {
                                        app.cancel_download().await;
                                    });
                                }
                                KeyCode::Char('/') => {
                                    app.input_mode = crate::ui::InputMode::Search;
                                    app.search_query.clear();
                                }
                                KeyCode::Char('s') => {
                                    app.show_settings = !app.show_settings;
                                }
                                KeyCode::Char('t') => {
                                    app.next_theme();
                                }
                                KeyCode::Char('m') => {
                                    app.toggle_theme_mode();
                                }
                                KeyCode::Esc => {
                                    app.show_help = false;
                                    app.show_settings = false;
                                }
                                _ => {}
                            }
                        }
                        crate::ui::InputMode::Search => {
                            match key.code {
                                KeyCode::Enter => {
                                    rt.block_on(async {
                                        app.search().await;
                                    });
                                    app.input_mode = crate::ui::InputMode::Normal;
                                }
                                KeyCode::Esc => {
                                    app.input_mode = crate::ui::InputMode::Normal;
                                    app.search_query.clear();
                                }
                                KeyCode::Char(c) => {
                                    app.search_query.push(c);
                                }
                                KeyCode::Backspace => {
                                    app.search_query.pop();
                                }
                                _ => {}
                            }
                        }
                        crate::ui::InputMode::Settings => {
                            match key.code {
                                KeyCode::Esc => {
                                    app.input_mode = crate::ui::InputMode::Normal;
                                    app.show_settings = false;
                                }
                                KeyCode::Enter => {
                                    app.save_settings();
                                }
                                KeyCode::Down | KeyCode::Char('j') => {
                                    app.next_setting();
                                }
                                KeyCode::Up | KeyCode::Char('k') => {
                                    app.previous_setting();
                                }
                                KeyCode::Char(c) => {
                                    app.edit_setting(c);
                                }
                                KeyCode::Backspace => {
                                    app.backspace_setting();
                                }
                                _ => {}
                            }
                        }
                    }
                }
            }
        }

        // Update download progress
        rt.block_on(async {
            app.update_downloads().await;
        });
    }
}
