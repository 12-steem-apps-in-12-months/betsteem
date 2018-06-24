///////// GLOBAL VARIABLES /////////
	var community     = 'betstem';
	var quinielasPost = 'quinielas-russia-2018-betsteem--'
	var exchangePosts = 'fifa-world-cup-matches-jun24-betstem'
	var strings       = {
		countries: {
			"Russia":"ru","Saudi Arabia":"sa","Egypt":"eg","Uruguay":"uy","Morocco":"ma","Iran":"ir","Portugal":"pt","Spain":"es","France":"fr","Australia":"au","Argentina":"ar","Iceland":"is","Peru":"pe","Denmark":"dk","Croatia":"hr","Nigeria":"ng","Costa Rica":"cr","Germany":"de","Mexico":"mx","Brazil":"br","Switzerland":"ch","Sweden":"se","South Korea":"kr","Belgium":"be","Panama":"pa","Tunisia":"tn","England":"gb","Colombia":"co","Japan":"jp","Poland":"pl","Senegal":"sn", "Serbia": "rs"
		},
		months: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
		days: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
		buttons: {
			login: 'Login',
			wait: '<i class="fas fa-spinner fa-spin"></i>'
		}
	}
///////// GLOBAL FUNCTIONS /////////
	// GLOBAL
		//Avoid closing the login dropdown by clicking inside it
			$(document).on('click', '.logindropdown', function (e) {
			  e.stopPropagation();
			});

		//Encode & decode content
			function encodeContent(_content){
				if(typeof(_content) === 'object'){
					_content = JSON.stringify(_content);
				}
				var $encoded = encodeURIComponent(_content);//Encode it like 'Esta es una canción' => 'esta%20es%20una%20canci%C3%B3n'
				var $btoa = btoa($encoded);//Convert the encoded content into base64
				return $btoa;
			}
			function decodeContent(_content){
				var $atob = atob(_content);//Decode base 64 content into like 'esta%20es%20una%20canci%C3%B3n'
				var $decoded = decodeURIComponent($atob)//Decode the previous content into 'Esta es una canción'
				try {
				  $decoded = JSON.parse($decoded);//If $decoded can be parsed is an object so needs to be parsed
				}
				catch (exception) {//Else do nothing, it's a string and it's good as is
					//
				}
				return $decoded
			}

		//Save a vaule into session or local storage
			function cacheVar(_key, _val, _remember){
				var val      = typeof(_val) === 'object' ? JSON.stringify(_val) : _val;
				var btoa     = encodeContent(val);//Content must be encoded to save in local storage
				var $storage = _remember ? localStorage : sessionStorage;//If remember true save local else session
				
				delete $storage[_key];//in case the key already exists delete it, we'll save a updated version

				try{
					$storage[_key] = btoa;//If there is space in the storage save it
				}catch(exception){//If there's no space, first delete the first item in storage, then try again
					var deletePosition = Object.keys($storage)[0] === 'steemgit' ? 1 : 0;
					delete $storage[Object.keys($storage)[deletePosition]];
					cacheVar(_key, _val, _remember)
				}
			}

		//Convert date
			function convertDate(_date, _format){
				var time    = _date.split("T")[1];
				_date    		= _date.substr(0, _date.lastIndexOf("T"));
				var year    = _date.substr(0, _date.indexOf("-"));
				var month   = strings.months[parseInt(_date.split('-')[1]) - 1];
				var day     = _date.split('-')[2];
				if(_format === 'closing'){
					return 'Voting closes on ' + month + ', ' + day + ' at ' + time + ' GMT';
				}else if(_format === 'starts'){
					return month + ', ' + day + ' at ' + time + ' GMT';
				}
			}

		//On voteQuiniela modal hide
			function hideVoteModal(){
				$('#voteQuiniela').modal('hide');
			}
			$(document).on('hidden.bs.modal', '#voteQuiniela', function (e) {
			  $('#voteQuiniela .modal-title').empty();
			  $('#voteQuiniela .publishing').removeClass('d-none');
			  $('#voteQuiniela .close, #voteQuiniela .wait, #voteQuiniela .success, #voteQuiniela .publish-post, #voteQuiniela .published').addClass('d-none');
			})
			$(document).on('hidden.bs.modal', '#exchangeModal', function (e) {
			  $('#exchangeModal .review, #exchangeModal .confirm-bet, #exchangeModal table').removeClass('d-none');
			  $('#exchangeModal .wait, #exchangeModal .confirm, #exchangeModal .waiter').addClass('d-none');
			})
	
		//Get current GMT time
			function getTime(){
				return new Promise(resolve => {
					$.get("http://api.timezonedb.com/v2/get-time-zone?key=ZMSNQ4EDMNQ0&format=json&by=zone&zone=America/Danmarkshavn", function(data, status){
			      var time = data.formatted;
			      resolve(time);
			    });
				})
			}

		//Clicking the stake input if its value is 0 clear value, its uncomfortable to place a value when there's a 0 in it
			$(document).on('click', 'input.stake', function(){
				if(this.value == 0){
					this.value = ''
				}
			})

	//STEEM
		function getSteemUser(user, repeated){
			return new Promise(resolve => {
				steem.api.getAccounts([user], function(err, users){
					if(err){
						if(repeated){
							alert('Ooops something went wrong (get steemit user)\n' + err)
							hideVoteModal()
						}else{
							getSteemUser(user, true)
						}
					}else{
						resolve(users[0])
					}
				})
			})
		}

		async function getCurrentVoteValue(user, weight){
			var $user = await getSteemUser(user);
			return new Promise(async resolve => {
				var received_vesting_shares           = parseFloat($user.received_vesting_shares.replace(" VESTS", ""))
				var vesting_shares                    = parseFloat($user.vesting_shares.replace(" VESTS", ""))
				var delegated_vesting_shares          = parseFloat($user.delegated_vesting_shares.replace(" VESTS", ""))
				var effective_vesting_shares          = vesting_shares - delegated_vesting_shares + received_vesting_shares
				var secondsago                        = (new Date - new Date($user.last_vote_time + "Z")) / 1000
				var voting_power                      = $user.voting_power + (10000 * secondsago / 432000)
				voting_power                          = (Math.min(voting_power / 100, 100).toFixed(2))*100;
				var STEEMIT_VOTE_REGENERATION_SECONDS = 5 * 60 * 60 * 24; // it takes 5 days to regenerate 100% voting power
				var STEEMIT_100_PERCENT               = 10000;
				var current_voting_power              = voting_power;
				var vote_pct_weight                   = weight;
				var fund                              = await getRewardFund();
				var pot                               = parseFloat(fund.reward_balance.replace(" STEEM", ""));
				var total_r2                          = parseInt(fund.recent_claims, 10);
				var weighted_power                    = (current_voting_power * vote_pct_weight) / STEEMIT_100_PERCENT;
				var voting_power_used                 = weighted_power/50
				var rshares                           = Math.floor(((effective_vesting_shares * voting_power_used)/10000)*1000000);
				var _steem                            = 0;
				var contrib                           = rshares * pot / total_r2
				_steem                                += contrib;
				var feed                              = await getFeedHistory();
				var sbdBase                           = feed.current_median_history.base.replace(' SBD', '');
				var sbd                               = _steem * sbdBase;
				var voting                            = {
					power  : voting_power,
					weight : weight,
					vests  : effective_vesting_shares,
					shares : rshares,
					sbd    : sbd,
					secondsago: secondsago
				}
				resolve(voting );
			})
		}

		async function getCastedVoteValue(par){
			return new Promise(async resolve => {
				var fund = par.fund ? par.fund : await getRewardFund();
				var feed = par.feed ? par.feed : await getFeedHistory();
				var total_r2 = parseInt(fund.recent_claims, 10)
				var pot = fund.reward_balance.replace(' STEEM', '');
				var _steem = par.rshares * pot / total_r2;
				var sbdBase = feed.current_median_history.base.replace(' SBD', '');
				var sbd = _steem * sbdBase;
				resolve(sbd)
			})
		}

		function getRewardFund(repeated){
			return new Promise(resolve => {
				steem.api.getRewardFund("post", function(err,reward_fund){
					if(err){
						if(repeated){
							alert('Ooops something went wrong (get reward fund)\n' + err)
							hideVoteModal()
						}else{
							getRewardFund(true)
						}
					}else{
						resolve(reward_fund);
					}
				})
			})
		}

		function getFeedHistory(repeated){
			return new Promise(resolve => {
				steem.api.getFeedHistory(function(err, feed_history){
					if(err){
						if(repeated){
							alert('Ooops something went wrong (get feed history)\n' + err)
							hideVoteModal()
						}else{
							getRewardFund(true)
						}
					}else{
						resolve(feed_history);
					}
				})
			})
		}

		function castVote(par, repeated){
			return new Promise(resolve => {
				steem.broadcast.vote(
	    		par.wif, 
	    		par.voter,
	    		par.author,
	    		par.permlink, 
	    		par.weight, 
	    		async function(err, vote){
	    			if(err){
	    				if(repeated){
	    					if(par.author !== community){
	    						var deletePost = await deleteComment(par);
	    					}
		    				if(err.message === "Assert Exception:info->abs_rshares > STEEM_VOTE_DUST_THRESHOLD || vote_weight == 0: Voting weight is too small, please accumulate more voting power or steem power."){
		    					alert('You have not enough voting power');
		    					hideVoteModal()
		    				}else{
		    					alert('Ooops something went wrong (cast vote)\n' + err)
		    					hideVoteModal()
		    				}
	    				}else{
	    					castVote(par, true)
	    				}
	    			}else{
	    				resolve(vote);
	    			}
	    		}
	    	)
    	})
		}

		function deleteComment(par){
			return new Promise(resolve => {
				steem.broadcast.deleteComment(par.wif, par.author, par.permlink, function(err, result){
					resolve(result)
				})
			})
		}

		function getPost(par){
			return new Promise(resolve => {
				steem.api.getContent(par.author, par.permlink, async function(err, post) {
					if(err){
						if(repeated){
							alert('Ooops something went wrong (get post)\n' + err)
							hideVoteModal()
						}else{
							getPost(par, true);
						}
					}else{
						if(post.children > 0){
							post.replies = await fetchreplies(post)
						}
						console.log(post)
						resolve(post)
					}
				});
			})
		}

		function fetchreplies(post, nested){
			return new Promise(resolve => {
				steem.api.getContentReplies(post.author, post.permlink, async function(err, comments) {
					resolve(comments)
				})
			})
		}

		function getActiveVotes(post){
			return new Promise(resolve => {
				steem.api.getActiveVotes(post.author, post.permlink, function(err, votes) {
				  resolve(votes)
				});
			})
		}

		function postComment(par, repeated){
			return new Promise(resolve => {
				steem.broadcast.comment (
				  par.private_posting_wif,  // Steemit.com Wallet -> Permissions -> Show Private Key (for Posting)
				  par.parent_author,        // empty for new blog post - also empty for editing an existing post
				  par.parent_permlink,      // main tag for new blog post - for post editing it's the parent_permalink parameter from original post
				  par.author,               // same user the private_posting_key is for
				  par.permlink,             // a slug (lowercase 'a'-'z', '0'-'9', and '-', min 1 character, max 255 characters) - permalink from original for editing
				  par.title,                // human-readable title - title fron original for editing
				  par.body,                 // body of the post or comment
				  par.json_metadata,        // arbitrary metadata
				  async function(err, comment){
				  	if(err){
				  		if(repeated){
				  			alert('Ooops something went wrong (post comment)\n' + err)
				  			hideVoteModal()
				  		}else{
				  			postComment(par, true)
				  		}
				  	}else{
				  		if(par.beneficiaries){
				  			var options = await commentOptions(par);
				  			resolve({comment: comment, options: options})
				  		}else{
				  			console.log(err, comment)
				  			resolve({comment: comment})
				  		}
				  	}
				  }
				)
			});
		}

		function commentOptions(par, repeated){
			return new Promise(resolve => {
				steem.broadcast.commentOptions(
	        par.private_posting_wif,
	        par.author, //author
	        par.permlink, //permalink
	        '1000000.000 SBD', //max accepted payout
	        10000, //Percent steem dollars is the option that determines what percentages you want your rewards in, with 10000 meaning 50/50 as usual, and 0 meaning 100% power up.
	        par.allowVotes, //allowVotes
	        par.allowCuration, //allowCurationRewards
	        [
	        	[
	        		0, 
	        		{
	          		"beneficiaries": par.beneficiaries
	        		}
	        	]
	        ],
	        function (err, options) {
	          if(err){
	          	if(repeated){
				  			alert('Ooops something went wrong (comment options)\n' + err)
				  			hideVoteModal()
				  		}else{
				  			commentOptions(par, true)
				  		}
	          }else{
	          	resolve(options)
	          }
	        }
	      );
			})
		}

		function estimateVote(user, weight){
			steem.api.getRewardFund("post", function(err,reward_fund){
				var recent_claims = parseInt(reward_fund.recent_claims);
				var reward_balance = parseFloat(reward_fund.reward_balance.replace(" STEEM", ""))
				steem.api.getAccounts([user], function(err, users){
					var user                     = users[0];
					var vesting_shares           = parseFloat(user.vesting_shares.replace(" VESTS", ""))
					var received_vesting_shares  = parseFloat(user.received_vesting_shares.replace(" VESTS", ""))
					var delegated_vesting_shares = parseFloat(user.delegated_vesting_shares.replace(" VESTS", ""))
					var total_vests              = vesting_shares + received_vesting_shares - delegated_vesting_shares;
					var final_vest               = total_vests * 1e6;
					var secondsago               = (new Date - new Date(user.last_vote_time + "Z")) / 1000
					//var voting_power             = user.voting_power + (10000 * secondsago / 432000)
					var voting_power = user.voting_power;
					weight                       = weight * 100
					var power                    = (voting_power * weight / 10000) / 50
					var rshares                  = power * final_vest / 10000
					steem.api.getFeedHistory(function(err, feed_history){
						var sbd_median_price = parseFloat(feed_history.current_median_history.base.replace(" VESTS", ""))
						
						//////////////// Calculate /////////////////
						var estimate = rshares / recent_claims * reward_balance * sbd_median_price
						console.log(rshares, estimate)
					})
				})
			})
		}

///////// VUE /////////
window.app = new Vue({
	el: '#app',
	delimiters: ["{[","]}"],
	data: {
		steem     : {name: null, avatar: null, wif: null, voting: null},
		errors    : {wif: false, mismatch: false, notFound: false, steemit: false},
		quinielas : {items: null, votes: {}},
		gtm       : '',
		matches   : {},
		bet       : {day: '', type: '', post: '', stake: 0, selection: '', liability: 0, limit: null, payout: null},
		voteValue : {}
	},
	methods: {
		steemLogin: async function(event){
			var user;
			var userName = this.$refs.username.value;
			var wif      = this.$refs.wif.value;
			var remember = this.$refs.remember.checked;
			this.errors  = {wif: false, mismatch: false, notFound: false};

			if(wif.length !== 51 || !wif.startsWith('5')){
				this.errors.wif = true;
			}else{
				event.target.innerHTML = strings.buttons.wait;
				var $user = await getSteemUser(userName);//get user
				if($user.err){
					this.errors.steemit = err;
				}else {
					if($user.name){
						var pubWif = $user.posting.key_auths[0][0];//Get the public wif wich will be compared with the private one
						try{ isvalid = steem.auth.wifIsValid(wif, pubWif); }//compare public vs private
						//The verification returns true or false if a valid private key is passed but if you change a character and make the private invalid it doesn't return true or false but an error so we use a catch function to set the isvalid to false
						catch(e){ isvalid = false; }
						if(isvalid == true){
							var userData = {
								name: $user.name,
								avatar: 'https://img.busy.org/@' + $user.name + '?size=20',
								wif: wif
							}
							cacheVar('steem', userData, remember);//storage it on browser storage
							this.$refs.username.value = this.$refs.wif.value = '';
							event.target.innerHTML = strings.buttons.login;
							userData.voting = await getCurrentVoteValue(userData.name, 10000);
							this.$set(this, 'steem', userData);
						}else{
							event.target.innerHTML = strings.buttons.login;//reactivate the button
							this.errors.mismatch = true;//show password mismatch error
						}
					}else{
						event.target.innerHTML = strings.buttons.login;
						this.errors.notFound   = true;//show no user found error
					}
				}
			}
		},
		getFlag(name){
			var url = 'https://lipis.github.io/flag-icon-css/flags/4x3/'
			url += strings.countries[name];
			url += '.svg'
			return url;
		},
		convertDate(_date, _format){

			return convertDate(_date, _format);
		},
		voteQuiniela: async function(quiniela){
			//Show modal
			$('#voteQuiniela').modal('show');
			$('#voteQuiniela .modal-title').text('Registering your quiniela');
			$('#voteQuiniela .wait').removeClass('d-none');

			var selectedVoteValue = parseInt(this.$refs['voteValue' + quiniela][0].value);
			var castedVoteValue;
			//Get current voting value, current_voting_power may have changed since last time calculated
			var currentVoteValue  = await getCurrentVoteValue(this.steem.name, 10000);
			//this is the needed weight to produce a vote with the selected value.
			var voteWeight = 10000 * selectedVoteValue /currentVoteValue.sbd
			//voteWeight may be higher than 100% (10000). Example a vote at 100% weight is 0.0016, if I try to get the weight needed vor a 1.00 vote I get a weight higher than 100% so if it's higger than 100 make  it 100
			voteWeight = voteWeight > 10000 ? 10000 : voteWeight;
			var quiniela = this.quinielas.items[quiniela];
			var tBody = '';
			$.each(quiniela.matches, function(i,v){
				delete v.starts
				tBody += '<tr><td>' + Object.keys(v)[0] + '</td>'
				tBody += '<td align="center">' + Object.values(v)[0] + '</td>'
				tBody += '<td align="center">vs</td>'
				tBody += '<td align="center">' + Object.values(v)[1] + '</td>'
				tBody += '<td align="right">' + Object.keys(v)[1] + '</td></tr>'
			})
			this.$refs.tBody.innerHTML = tBody;
			var replyPermlink = steem.formatter.commentPermlink(community, quinielasPost);
			var reply_meta = {
				community : 'betsteem', 
				app       : 'betsteem/1.0.0', 
				tags      : ['betsteem', 'quiniela', 'world-cup', 'betting', 'steemdev'], 
				links     : ['https://betsteem.com/quinielas'],
				format    : 'html',
				quiniela  : quiniela,
				vote      : currentVoteValue
			}
			var comment = await postComment({//Create a comment with the selection data
				private_posting_wif: this.steem.wif,  
			  parent_author: community,
			  parent_permlink: quinielasPost,
			  author: this.steem.name,
			  permlink: replyPermlink,
			  title: 'quiniela' + this.$refs.postTitle.id,//change for some data in the vote response
			  body: this.$refs.qTable.innerHTML,
			  json_metadata: JSON.stringify(reply_meta),
			})
			var options = await commentOptions({
				private_posting_wif: this.steem.wif,
        author:this.steem.name, 
        permlink:replyPermlink, 
        allowVotes:true, 
        allowCuration:false, 
        beneficiaries: [{account: community, weight: 10000}]
			})
			var vote = await castVote({//Vote on that comment
				wif: this.steem.wif,
    		voter: this.steem.name,
    		author: this.steem.name,
    		permlink: replyPermlink, 
    		weight: voteWeight
			})

			this.$refs.postTitle.id = vote.id;
			$('#voteQuiniela .wait').addClass('d-none');
			$('#voteQuiniela .success').removeClass('d-none');
		},
		postQuiniela: async function(){
			$('#voteQuiniela .modal-title').text('Publishing your post');
			$('#voteQuiniela .success').addClass('d-none')
			$('#voteQuiniela .publish-post').removeClass('d-none')

			var meta = {
				community : 'betsteem', 
			  app       : 'betsteem/1.0.0', 
			  tags      : ['betsteem', 'quiniela', 'world-cup', 'betting', 'steemdev'], 
			  links			: ['https://betsteem.com/quinielas'],
			  format    : 'html',
			}
			var comment = await postComment({
				private_posting_wif : this.steem.wif,
				parent_author       : '',
				parent_permlink     : 'betsteem',
				author              : this.steem.name,
				permlink            : 'quiniela-' + this.$refs.postTitle.id,
				title               : this.$refs.postTitle.innerText,
				body                : this.$refs.postContent.innerHTML,
				json_metadata       : JSON.stringify(meta)
			})
			$('#voteQuiniela .publish-post .publihing').addClass('d-none')
			$('#voteQuiniela .publish-post .published, #voteQuiniela .close').removeClass('d-none')
		},
		getJackpot(array){
			var totals = [0, 0]
			$.each(array, function (i,v){
				totals[0] ++;
				totals[1] += v;
			})
			return totals
		},
		getMatchDate(date, time){
			var d = new Date(date);
			if(time){
				return strings.days[d.getDay()] + '<br>' + date.split(' ')[1].substr(0, date.split(' ')[1].lastIndexOf(":"));
			}else{
				return strings.days[d.getDay()] + ' ' + d.getDate() + ' ' + strings.months[d.getMonth()];
			}
		},
		profitConfirm(type){
			var profit = type === 'back' ? this.bet.stake * (this.bet.odds - 1) : this.bet.stake;
			var fee = profit * 0.1;
			var risked = type === 'back' ? this.bet.stake : this.bet.liability;
			var payout = risked + (profit - fee);
			this.$set(this.bet, 'payout', payout);
			var html = '<div>Profit: <span class="float-right">$' + profit.toFixed(8) + '</span></div>';
			html      += '<div>- fee(10%): <span class="float-right">$' + fee.toFixed(8) + '</span></div>';
			if(type === 'back'){
				html      += '<div>+ Your stake: <span class="float-right">$' + this.bet.stake.toFixed(8) + '</span></div>';
			}else{
				html      += '<div>+ Your liability: <span class="float-right">$' + this.bet.liability.toFixed(8) + '</span></div>';
			}
			html      += '<div>Total payout: <span class="float-right"><b>$' + payout.toFixed(8) + '</b></span></div>';
			$('#exchangeModal .payout').html(html)
		},
		placeBet: async function(){
			$('#exchangeModal .review, #exchangeModal .confirm-bet, #exchangeModal table').addClass('d-none');
			$('#exchangeModal .wait, #exchangeModal .waiter').removeClass('d-none');
			var selectedVoteValue = this.bet.type === 'back' ? this.bet.stake : this.bet.liability;
			//Get current voting value, current_voting_power may have changed since last time calculated
			var currentVoteValue  = await getCurrentVoteValue(this.steem.name, 10000);
			//this is the needed weight to produce a vote with the selected value.
			var voteWeight = 10000 * selectedVoteValue /currentVoteValue.sbd;
			//voteWeight may be higher than 100% (10000). Example a vote at 100% weight is 0.0016, if I try to get the weight needed vor a 1.00 vote I get a weight higher than 100% so if it's higger than 100 make  it 100
			voteWeight = voteWeight > 10000 ? 10000 : voteWeight;
			var vote = await castVote({//Vote on that comment
				wif: this.steem.wif,
    		voter: this.steem.name,
    		author: community,
    		permlink: this.bet.post, 
    		weight: voteWeight
			})
			console.log(vote)
			var replyPermlink = steem.formatter.commentPermlink(community, this.bet.post);
			var reply_meta = {
				community : 'betsteem', 
				app       : 'betsteem/1.0.0', 
				tags      : ['betsteem', 'betting-exchange', 'world-cup', 'betting'], 
				links     : ['https://betsteem.com'],
				format    : 'html',
				vote      : vote,
				bet       : this.bet
			}
			var comment = await postComment({//Create a comment with the selection data
				private_posting_wif: this.steem.wif,  
			  parent_author: community,
			  parent_permlink: this.bet.post,
			  author: this.steem.name,
			  permlink: replyPermlink,
			  title: this.bet.type + '-' + this.bet.selection,
			  body: this.bet.type + ' ' + this.bet.selection + ' at ' + this.bet.odds + ' for ≈$' + this.bet.stake,
			  json_metadata: JSON.stringify(reply_meta),
			})
			$('#exchangeModal .wait, #exchangeModal .waiter').addClass('d-none');
			$('#exchangeModal .confirm, #exchangeModal table').removeClass('d-none');
		},
		getLiquidity(bet, get){
			var $return = {
				back: 0,
				lay: 0
			}
			if(bet.back > bet.lay){
				$return.back = 0;
				$return.lay = bet.back - bet.lay;
			}else if(bet.lay > bet.back){
				$return.back = bet.lay - bet.back;
				$return.lay = 0;
			}
			return($return[get]);
		},
		getMatchedAmmount(match){
			var matched = 0;
			if(match.away.bets.back < match.away.bets.lay){
				matched += match.away.bets.back
			}else{
				matched += match.away.bets.lay
			}
			if(match.draw.bets.back < match.draw.bets.lay){
				matched += match.draw.bets.back
			}else{
				matched += match.draw.bets.lay
			}
			if(match.home.bets.back < match.home.bets.lay){
				matched += match.home.bets.back
			}else{
				matched += match.home.bets.lay
			}
			return matched;
		}
	},
	created: async function(){
		if(localStorage['steem'] || sessionStorage['steem']){
			try{//We don't know if user stored on local or session so try first with local then with session
				this.steem = decodeContent(localStorage['steem']);
			}catch(exception){
				this.steem = decodeContent(sessionStorage['steem']);
			}
			var voting = await getCurrentVoteValue(this.steem.name, 10000);
			this.$set(this.steem, 'voting', voting)
		}
		if($('#quinielas').length > 0){//if page is quinielas
			if(this.steem.name){
				await getCurrentVoteValue(this.steem.name, 10000)
			}
			//Get the post containing the quinielas and save the quinielas data
			var post = await getPost({author:community, permlink:quinielasPost, nested: false});
			this.$set(this.quinielas, 'items', JSON.parse(post.json_metadata).quinielas);
			$('body').removeClass('loading');
			//Create the object that will contain the votes divided by ammount
			for(i=0; i<Object.keys(this.quinielas.items).length; i++){
				var quiniela = this.quinielas.items[i]
				var name     = quiniela.name;
				this.$set(this.quinielas.votes, name, {1: [], 3: [], 5: [], 10: [], 15: [], 20: []})
			}

			//Get fund and feed in order to calculate vote value from rshares
			var fund   = await getRewardFund();
			var feed   = await getFeedHistory();

			//Get every reply and extract the rshares generated by the vote, then store it in the "casted" object inside the corresponding object, example: "casted['Round 2']"
			var casted = {};
			
			for(i=0; i<post.replies.length; i++){
				var reply   = post.replies[i];
				var meta    = JSON.parse(reply.json_metadata);
				var name    = meta.quiniela.name;
				var rshares = meta.vote.shares;
				if(name in casted){
				}else{
					casted[name] = []
				}
				var sbd = await getCastedVoteValue({
					fund: fund,
					feed: feed,
					rshares: rshares
				})
				casted[name].push(parseFloat(sbd.toFixed(4)));
			}
			//Get every value inside the "casted" object and determine if the value is closest to 1,3,5,10,15 or 20 to store it in the corresponding array.
			for(key in casted){
				var quiniela = casted[key];
				
				for(i=0; i<quiniela.length; i++){
					var value = quiniela[i];
					if(value > 0){
						if(Math.floor(value) in this.quinielas.votes[key]){
							this.quinielas.votes[key][Math.floor(value)].push(value);
						}else if(Math.ceil(value) in this.quinielas.votes[key]){
							this.quinielas.votes[key][Math.ceil(value)].push(value);
						}else{
							var diff = [];
							for(Key in this.quinielas.votes[key]){
								var dif = value - Key;
								dif = dif < 0 ? -dif : dif;
								diff.push(dif)
							}
							var min = Math.min(...diff)
							this.quinielas.votes[key][Object.keys(this.quinielas.votes[key])[diff.indexOf(min)]].push(value)
						}
					}
				}
			}
		}
		if($('#exchange').length > 0){
			$this = this;
			var time = await getTime()
			this.$set(this, 'gtm', time)
		  var matches = {};
			steem.api.getDiscussionsByBlog({tag: community, limit: 100}, function(err, posts) {
			  $.each(posts, async function(i,post){
			  	if(post.permlink.startsWith(exchangePosts)){
			  		var replies = await fetchreplies({author: community, permlink: post.permlink})//Each of this replies is a match for that day (the day is defined by the top post)
			  		$.each(replies, function(i,reply){
			  			if(reply.author === community){
				  			var match = JSON.parse(reply.json_metadata).match;
				  			match.permlink = reply.permlink;
				  			var day = match.date.split(' ')[0]
				  			if(match.date > $this.gtm){
					  			if(day in matches){
					  				matches[day].push(match)
					  			}else{
					  				matches[day] = [match];
					  			}
					  		}
			  			}
			  		})
			  		/* Just for development*/
				  		$.each(matches, function(i,v){
				  			$.each(v, function($i, $v){
				  				delete $v.away.liquidity
				  				delete $v.home.liquidity
				  				delete $v.draw.liquidity
				  				$v.away.bets = {back: 0, lay: 0}
				  				$v.home.bets = {back: 0, lay: 0}
				  				$v.draw.bets = {back: 0, lay: 0}
				  			})
				  		})
			  		
			  		$this.$set($this, 'matches', matches);

			  		var bets = []
			  		for(i=0; i<replies.length; i++){
			  			match = replies[i];
			  			var comments = await fetchreplies({author: community, permlink: match.permlink})
			  			bets = bets.concat(comments)
			  		}
			  		
			  		var $matches = $this.matches;
			  		for(i=0; i<bets.length; i++){
							var bet       = bets[i];
							var betDetail = JSON.parse(bet.json_metadata).bet;
							var selection = betDetail.selection;
							var type      = betDetail.type;
							var stake     = betDetail.stake;
							var post      = betDetail.post;
			  			$.each($matches, function(day, matchList){
			  				$.each(matchList, function(index, match){
			  					if(match.permlink === post){
			  						if(type === 'Draw'){
			  							//match.draw.bets = {back: 0, lay: 0};
			  							match.draw.bets[type] += stake;
			  							return;
			  						}else{
			  							if(match.away.name === selection){
			  								//match.away.bets = {back: 0, lay: 0};
			  								match.away.bets[type] += stake;
			  								return;
			  							}else if(match.home.name === selection){
			  								//match.home.bets = {back: 0, lay: 0};
			  								match.home.bets[type] += stake;
			  								return;
			  							}
			  						}
			  					}
			  				})
			  			})
			  		}
			  		$this.$set($this, 'matches', $matches);
			  	}
			  })
			});
		}
	},
	watch: {
		bet: {
			handler: function(newValue) {
				if(this.steem.name){
					var liability = newValue.stake * (newValue.odds - 1)
					this.$set(this.bet, 'liability', liability)
					if(this.bet.type === 'back'){
						if(newValue.stake > this.steem.voting.sbd){
							var maxStake = this.steem.voting.sbd
							this.$set(this.bet, 'limit', maxStake)
						}else{
							this.$set(this.bet, 'limit', null)
						}
					}else{
						if(this.bet.liability > this.steem.voting.sbd){
							var maxStake = this.steem.voting.sbd / (newValue.odds - 1);
							this.$set(this.bet, 'limit', maxStake)
						}else{
							this.$set(this.bet, 'limit', null)
						}
					}
				}
      },
      deep: true
		}
	}
})