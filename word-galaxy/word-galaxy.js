import * as React from 'react';
import { Box, InputLabel, Typography, Select, Stack, MenuList, MenuItem, TextField, FormControl, Button, Slider, TextareaAutosize, Link } from '@mui/material';
import { GPTWrapper } from './gpt-wrapper.js'
import KeyModal from './keyModal.js'
import FaqModal from './faqModal.js'
//import ArticleMode from './articleMode.js'
import FeedbackModal from './feedbackModal.js'
import { idToArticleStyle } from './defs-articles.js'
import { Editor } from "react-draft-wysiwyg";
import { EditorState, ContentState } from 'draft-js'; // convertToRaw
import "react-draft-wysiwyg/dist/react-draft-wysiwyg.css";
//import draftToHtml from 'draftjs-to-html';
import htmlToDraft from 'html-to-draftjs';

const logService = "https://134-209-213-18.nip.io:4017"

const modeQuick = "Quick Workflow"

const modeCustom = "Custom Workflow"

// Error logging
async function postData(url = "", data = {}) {
  const response = await fetch(url, {
	method: "POST",
	mode: "cors", // no-cors, *cors, same-origin
    cache: "no-cache", // *default, no-cache, reload, force-cache, only-if-cached
	credentials: "same-origin", // include, *same-origin, omit
	headers: {
	  "Content-Type": "application/json",
	  // 'Content-Type': 'application/x-www-form-urlencoded',
	},
	redirect: "follow", // manual, *follow, error
	referrerPolicy: "no-referrer", // no-referrer, *no-referrer-when-downgrade, origin, origin-when-cross-origin, same-origin, strict-origin, strict-origin-when-cross-origin, unsafe-url
	body: JSON.stringify(data), // body data type must match "Content-Type" header
  });
  return response.json(); // parses JSON response into native JavaScript objects
}

const sendFeedback = (message, emailOpt) => {

	let msg = {
		message: message
	}

	if (emailOpt !== "") msg.email = emailOpt
	postData(logService + "/saveFeedback", msg)
}

/* 
Interface for Quick + Custom Article Workflow
*/
export default function GeneratorSimple() {

	const [editorState, setEditorState] = React.useState("");

	const onEditorStateChange = (value) => {
		setEditorState(value);
	};

	const [mode, setMode] = React.useState(modeQuick)
	
	const toggleMode = () => {
		setMode(mode === modeQuick ? modeCustom : modeQuick)
	}

	const [keyword, setKeyword] = React.useState("");
	const [keywordHasError, setKeywordHasError] = React.useState(false)
	const [articleStyle, setArticleStyle] = React.useState(0);
	const [articleLengthSlider, setArticleLengthSlider] = React.useState(3);

	const [articleProgress, setArticleProgress] = React.useState(-1.0)
	function articleProgressText() {
		return articleProgress >= 0 ? parseInt(articleProgress).toString() + "%" : ""
	}

	// Now this is being used for error, and editor div is used for an actual article result
	const [articleResult, setArticleResult] = React.useState("")

	const [createButtonEnabled, setCreateButtonEnabled] = React.useState(true)

	let gptWrapper;

	const handleStyleChange = (event: SelectChangeEvent) => {
		setArticleStyle(event.target.value);
	};

	const handleKeywordChange = (event: React.ChangeEvent<HTMLInputElement>) => {
		const kw = event.target.value;
		// Validate
		if (keywordHasError) setKeywordHasError(false)
		setKeyword(kw)
	}

	async function handleCreateArticle() {
		
		let kw = keyword.trim()

		if (kw === "") {
			setKeywordHasError(true)
			return
		}
		else if (localStorage === undefined) {
			console.error("No local storage")
			return;
		} 
		else if (!localStorage.hasOwnProperty("apiKeyGPT")) {
			console.error("No local storagekey not set")
			setArticleResult("Please set your API key first.")
			return;
		}
		else if (localStorage.apiKeyGPT.trim() === "") {
			console.error("API key cannot be empty")
			setArticleResult("API key cannot be empty. Please set your API key.")
			return;
		}

		let key = localStorage.apiKeyGPT;
		setCreateButtonEnabled(false)
		// If any previous errors, hide them
		setArticleResult("")

		if (gptWrapper === undefined) {
			gptWrapper = new GPTWrapper(key)
		}
		
		const updateArticleProgress = (count, max) => {
			setArticleProgress(parseInt((count / parseFloat(max)) * 100))
		}

		await gptWrapper.WriteArticle_(kw, articleStyle, articleLengthSlider, updateArticleProgress)
			.then((res) => {
				console.log("Result: ", res)
				if (res.status === 200) {
					handleArticleResult(res.text);
				}
				else {
					//handleArticleResult("Error: " + res.error);

					let msgToShow = "There was an error generating the article. " + 
						"Please try again, and if the error continues try a different keyword or contact support."

					// If direct error from the API, display to user
					if (res.hasOwnProperty('errorShowUser')) {
						msgToShow = res.errorShowUser	
					}

					handleArticleResultError(
						msgToShow,
						res
					);
				}
			})

		// Test
		// setTimeout(function() {
		// 	handleArticleResult("");
		// }, 1500)
	}

	const handleArticleResult = (result) => {
		updateEditorContent(result)
		//setArticleResult(result)
		setCreateButtonEnabled(true);
		logMessages(keyword, result, "")
	}

	const handleArticleResultError = (msgToUser, error) => {
		setArticleResult(msgToUser)
		setCreateButtonEnabled(true);
		logMessages(keyword, "", error)
	}

	const logMessages = (query, text, error) => {
		try {
			postData(logService + "/saveArticleQAM", { query: query, text: text, error: error })
		}
		catch (error) {
			console.error("Error processing", error)
		}
	}

	const keywordInput = <TextField 
		id="select-keyword" 
		label="Keyword" 
		variant="outlined" 
		style={{ width: "48vw" }}
		inputProps={{ maxLength: 100 }}
		onChange={handleKeywordChange}
	/>

	const keywordInputError = <TextField
		error
		id="outlined-error-helper-text"
		label="Error"
		defaultValue=""
		helperText="Enter a valid keyword phrase."
		onChange={handleKeywordChange}
	/>

	const articleResultTextArea = <TextareaAutosize
		aria-label="Result"
		placeholder=""
		style={{ 
			width: "88vw", 
			visibility: articleResult === "" ? "hidden" : "visible",
			borderRadius: "8px",
			padding: "2vmin"
		}}
		value={articleResult}
	/>

	function apiKeyIfExists() {
		if (localStorage !== undefined) return localStorage.apiKeyGPT
		else return undefined
	}
	
	const updateEditorContent = (textWithHtml) => {
		console.log("Updating editor w/ result", textWithHtml)
		try {
			const contentBlock = htmlToDraft(textWithHtml);
			const contentState = ContentState.createFromBlockArray(contentBlock.contentBlocks);
			const doc = EditorState.createWithContent(contentState);
			console.log("Editor state: ", doc)
			setEditorState(doc)
		}
		catch (error) {
			console.warn("Error parsing result html to editor state: ", error)
			console.log(textWithHtml)
			setArticleResult(textWithHtml)
		}
	}

	// setTimeout(function() {
	// 	updateEditorContent("<p>THIS IS A TEST.</p>\n<h1>Big text</h1><p>Ok here is a para.\nHere is the next sent.\nHere's the one after.</p><h2>here is title</h2>")
	// }, 3000)

	/*
	Alternative editors
	-
	If read-only, could just setInnerHTML with output, but then need a custom onClick for selecting to copy paste the text, or a button

	Seems like the best right now:
	https://github.com/facebook/lexical

	There's one listed in essential react components list:
	https://github.com/syncfusion/ej2-react-ui-components

	wangEditor seems decent and simple
	https://www.npmjs.com/package/wangeditor
	https://www.wangeditor.com/demo/index.html?lang=en
	https://www.wangeditor.com/en/v5/getting-started.html#import-js-and-create-editor

	*/

	// https://jpuri.github.io/react-draft-wysiwyg/#/docs
	const EditorComponent = <Editor
		// toolbarHidden
		editorStyle={{fontSize: 12}}
		editorState={editorState}
		// toolbarClassName="toolbarClassName"
		// wrapperClassName="wrapperClassName"
		// editorClassName="editorClassName"
		onEditorStateChange={onEditorStateChange}
		toolbar={{
			options: ['inline', 'blockType'],
			inline: {
				options: ['bold', 'italic', 'underline'],//, 'strikethrough', 'monospace'],
				bold: { className: 'bordered-option-classname' },
				italic: { className: 'bordered-option-classname' },
				underline: { className: 'bordered-option-classname' },
				strikethrough: { className: 'bordered-option-classname' },
				code: { className: 'bordered-option-classname' },
			},
			blockType: {
				className: 'bordered-option-classname',
			},
			// fontSize: {
			// 	className: 'bordered-option-classname',
			// 	options: [12]
			// },
			// fontFamily: {
			// 	className: 'bordered-option-classname',
			// },
		}}
	/>;

	const pageTitle = <h2>{mode === modeQuick ? "Quick" : "Custom"} Article Workflow</h2>

	const toggleSomething = () => {
		if (false) toggleMode()
		else {
				return ""
		}
	}

	return (
		<div className="gen-simple flex-col">
			<div className="flex-row" style={{width: "100%", justifyContent: "space-between"}}>
				<div className="qaw-left flex-col">
					<div className="flex-row" style={{justifyContent: "center"}}>
						<div className="gen-title">{pageTitle}
						</div>
						<div style={{display: "flex", justifyContent: "center", alignItems: "center"}}>
							<KeyModal keyInitial={apiKeyIfExists()} />
						</div>
					</div>

					<div className="gen-content flex-col m2">
							<div className="flex-col">
								<div className="m2">
									{keywordHasError ? keywordInputError : keywordInput} 
								</div>
								<div className="m2">
									<FormControl>
										<InputLabel id="select-style-label">Style</InputLabel>
											<Select
												labelId="select-style-label"
												id="select-style"
												value={articleStyle}
												label="Style"
												onChange={handleStyleChange}
											>
											<MenuItem value={0}>{idToArticleStyle[0]}</MenuItem>
											<MenuItem value={1}>{idToArticleStyle[1]}</MenuItem>
											<MenuItem value={2}>{idToArticleStyle[2]}</MenuItem>
										</Select>
									</FormControl>
								</div>
							</div>
							<div className="m2" style={{width: "30vw"}}>
								<Typography id="article-length-slider-label" gutterBottom>
									Article Length
								</Typography>
								<Slider 
									defaultValue={3} 
									aria-label="Paragraphs per section" 
									valueLabelDisplay="auto"
									step={1}
									min={1}
									max={5}
									onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
										setArticleLengthSlider(event.target.value);
									}}
								/>
							</div>
							<div className="flex-row m2">
								<Button 
									variant="contained" 
									disabled={!createButtonEnabled}
									onClick={handleCreateArticle}
								>Create Article
								</Button>
								<Box className="m2">
									{articleProgressText()}
								</Box>
							</div>
						</div>
					</div>
					<div className="qaw-right flex-col m4">

						<Stack direction="row" spacing={2} sx={{width: "10vw", justifyContent: "flex-end"}}>
					      {/*<Paper>*/}
					        <MenuList>
					         {/*<MenuItem>F3</MenuItem>*/}
					         {/*<ArticleMode modeDisplayed={mode === modeQuick ? modeCustom : modeQuick} toggleMode={toggleMode}/>*/}
					         <div style={{display: "none"}}>{toggleSomething()}</div>
					          <FaqModal />
					          <FeedbackModal sendFeedback={sendFeedback} />

					          {/*<MenuItem>My account</MenuItem>
					          <MenuItem>Logout</MenuItem>*/}
					          <div style={{color: "#cccccc", width: "100%", textAlign: "right"}}>
								<Link href="/privacyPolicy.txt" 
									underline="hover" color="inherit" target="_blank" 
									style={{fontSize: "0.8rem", fontWeight: "bold", textAlign: "right"}}
									sx={{pr: 2}}>
									Privacy Policy
								</Link>
							</div>
					        </MenuList>
					      {/*</Paper>*/}
					    </Stack>

						
				</div>
			</div>
			
			<div className="gen-result m4">
				{articleResultTextArea}
			</div>
			{/*<div id="editor-container"></div>*/}
			{/*, backgroundColor: "#e5e5e5"*/}
			<div style={{width: "76vw", minHeight: "92vh", marginBottom: "6vh"}}>{EditorComponent}</div>

			{/*<textarea
				disabled
				value={draftToHtml(convertToRaw(editorState.getCurrentContent()))}
			/>*/}
			
		</div>
	);
}

/*
// delete localStorage.somekey;
// setLocalStorate(name, val) { localStorage.setItme(name, JSON.stringify(val)); }
*/
